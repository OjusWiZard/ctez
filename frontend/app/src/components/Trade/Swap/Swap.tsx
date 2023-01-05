import {
  Flex,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  useToast,
} from '@chakra-ui/react';
import { MdAdd, MdSwapVert } from 'react-icons/md';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormik } from 'formik';
import { addMinutes } from 'date-fns/fp';
import * as Yup from 'yup';
import { useWallet } from '../../../wallet/hooks';
import { useCfmmStorage, useCtezBaseStats, useUserBalance } from '../../../api/queries';
import {
  BUTTON_TXT,
  ConversionFormParams,
  FORM_TYPE,
  TFormType,
  TOKEN,
  TToken,
} from '../../../constants/swap';
import { CTezIcon, TezIcon } from '../../icons';
import { tezToCash, cfmmError, cashToTez , getCfmmStorage } from '../../../contracts/cfmm';
import { logger } from '../../../utils/logger';
import { useAppSelector } from '../../../redux/store';
import Button from '../../button';
import { useThemeColors, useTxLoader } from '../../../hooks/utilHooks';
import { formatNumberStandard, inputFormatNumberStandard } from '../../../utils/numbers';

const Swap: React.FC = () => {
  const [{ pkh: userAddress }] = useWallet();
  const [minBuyValue, setMinBuyValue] = useState(0);
  const [target, setTarget] = useState(0);
  const [formType, setFormType] = useState<TFormType>(FORM_TYPE.TEZ_CTEZ);
  const { data: cfmmStorage } = useCfmmStorage();
  const { data: balance } = useUserBalance(userAddress);
  const { t } = useTranslation(['common', 'header']);
  const toast = useToast();
  const { data: baseStats } = useCtezBaseStats();
  const [text2, inputbg, text4, maxColor] = useThemeColors([
    'text2',
    'inputbg',
    'text4',
    'maxColor',
  ]);
  const handleProcessing = useTxLoader();

  const { slippage, deadline: deadlineFromStore } = useAppSelector((state) => state.trade);
  const [minReceived, setMinReceived] = useState(0);
  const [priceImpact, setpriceImpact] = useState(0);

  const getRightElement = useCallback((token: TToken) => {
    if (token === TOKEN.Tez) {
      return (
        <InputRightElement backgroundColor="transparent" w={24}>
          <TezIcon height={28} width={28} />
          <Text mx={1}>tez</Text>
        </InputRightElement>
      );
    }

    return (
      <InputRightElement backgroundColor="transparent" w={24}>
        <CTezIcon height={28} width={28} />
        <Text mx={1}>ctez</Text>
      </InputRightElement>
    );
  }, []);

  const initialValues = useMemo<ConversionFormParams>(
    () => ({
      slippage: Number(slippage),
      deadline: Number(deadlineFromStore),
      amount: '',
    }),
    [deadlineFromStore, slippage],
  );

  const maxValue = (): number =>
    formType === FORM_TYPE.CTEZ_TEZ ? balance?.ctez || 0.0 : balance?.xtz || 0.0;



  const validationSchema = Yup.object().shape({
    slippage: Yup.number().min(0).optional(),
    deadline: Yup.number().min(0).required(t('required')),
    amount: Yup.number()
      .positive(t('shouldPositive'))
      .min(0.000001, `${t<string>('shouldMinimum')} 0.000001`)
      .max(maxValue(), `${t<string>('insufficientBalance')}`)
      .required(t('required')),
  });

  const { values, handleChange, handleSubmit, isSubmitting, errors, ...formik } = useFormik({
    onSubmit: async (formData) => {
      try {
        if (!userAddress || !formData.amount) {
          return;
        }
        const deadline = addMinutes(deadlineFromStore)(new Date());
        const result =
          formType === FORM_TYPE.TEZ_CTEZ
            ? await tezToCash({
              to: userAddress,
              minCashBought: minReceived,
              deadline,
              rounds: 4,
              amount: formData.amount,
            })
            : await cashToTez(
              {
                deadline,
                minTezBought: minReceived,
                to: userAddress,
                cashSold: formData.amount,
                rounds: 4,
              },
              userAddress,
            );
        handleProcessing(result);
      } catch (error: any) {
        logger.warn(error);
        const errorText = cfmmError[error.data[1].with.int as number] || t('txFailed');
        toast({
          status: 'error',
          description: errorText,
          duration: 5000,
        });
      }
    },
    initialValues,
    validationSchema,
  });

  const util = (x : number, y : number) =>{
    const plus = x + y;
    const minus = x - y ;
    const plus_2 = plus * plus;
    const plus_4 = plus_2 * plus_2;
    const plus_8 = plus_4 * plus_4;
    const plus_7 = plus_4 * plus_2 * plus;
    const minus_2 = minus * minus;
    const minus_4 = minus_2 * minus_2;
    const minus_8 = minus_4 * minus_4;
    const minus_7 = minus_4 * minus_2 * minus;
    return [Math.abs(plus_8 - minus_8), 8 * (Math.abs(minus_7 + plus_7))] // 8n to 8


  }

  const newton = (p:any):number => {
    if (p.n === 0) {
        return p.dy
    }
        const util_arr =  util((p.x + p.dx),(Math.abs(p.y - p.dy)));
        const new_u = util_arr[0];
        const new_du_dy = util_arr[1];
        const dy = p.dy + Math.abs((new_u - p.u) / new_du_dy);
        return newton({x:p.x , y:p.y ,dx: p.dx , dy ,u: p.u ,n: p.n - 1});
    
  }

  const newton_dx_to_dy =(
    args :any
  ) => {
    const xp = args.x + args.dx ;
    const u = util(args.x,args.y)[0] ;
    return newton({x:args.x , y:args.y, dx:args.dx , dy:0 , u  ,n:args.rounds})
  }


  const trade_dtez_for_dcash = (
    args : any
  ) =>{
    const x = args.tez * (2** 48); 
    const y = args.target * args.cash;
    const dx = args.dtez * (2** 48); 
    const dy_approx = newton_dx_to_dy({x, y, dx, rounds:args.rounds});
    const dcash_approx = dy_approx / args.target;
    return dcash_approx
  }

  const trade_dcash_for_dtez = (
    args : any
  ) => {
    const x = args.target * args.cash; 
    const y = args.tez * (2** 48);
    const dx = args.target * args.dtez; 
    const dy_approx = newton_dx_to_dy({x, y, dx, rounds:args.rounds});
    const dtez_approx = dy_approx / (2** 48);
    return dtez_approx
  }

  const fetchTarget = async () =>{
    if(cfmmStorage)
    {const c = cfmmStorage;
    setTarget(c.target.toNumber())}
  }
  useEffect(() => {
    fetchTarget()
  },[cfmmStorage])

  useEffect(() => {
    if (cfmmStorage && values.amount && (target>0)) {
      console.log(cfmmStorage,baseStats)
      const { cashPool: tokenPool, tezPool: cashPool } = cfmmStorage;
      const invariant = Number(cashPool) * Number(tokenPool);
      let initialPrice: number;
      const SwapAmount = values.amount * 1e6;
      let recievedPrice: number;
      const cashSold = values.amount * 1e6;
      let  tokWithoutSlippage = 0
      if (formType === FORM_TYPE.TEZ_CTEZ){
        // console.log(cashPool.toNumber(),tokenPool.toNumber() , cashSold , target , "swap math");
        tokWithoutSlippage = trade_dtez_for_dcash({tez:cashPool.toNumber() , cash:tokenPool.toNumber() , dtez: cashSold , target , rounds: 4});
        console.log()
      }
      else {
        tokWithoutSlippage = trade_dcash_for_dtez({tez:cashPool.toNumber() , cash:tokenPool.toNumber() , dtez: cashSold , target , rounds: 4});
        console.log("here",tokWithoutSlippage)
      }
      tokWithoutSlippage = (tokWithoutSlippage * 9999 / 10000)/1e6
      // if (formType === FORM_TYPE.CTEZ_TEZ) { // ctez to tez
      //   // 1 ctez = 11 tez
      //   initialPrice = Number(cashPool) / Number(tokenPool);
      //   const newTokenPool = Number(tokenPool) + SwapAmount * 0.9999;
      //   const newCashPool = invariant / newTokenPool;
      //   const difference = Number(cashPool) - newCashPool;
      //   recievedPrice = difference / SwapAmount;
      // } else { // tez to ctez
      //   initialPrice = Number(tokenPool) / Number(cashPool);
      //   const newCashPool = Number(cashPool) + SwapAmount * 0.9999;
      //   const newTokenPool = invariant / newCashPool;
      //   const difference = Number(tokenPool) - newTokenPool;
      //   recievedPrice = difference / SwapAmount;
      // }
      if (formType === FORM_TYPE.CTEZ_TEZ) { // ctez to tez
        // 1 ctez = 11 tez
        initialPrice = Number(cashPool) / Number(tokenPool);
        const newTokenPool = Number(tokenPool) + SwapAmount * 0.9999;
        const newCashPool = Number(cashPool) - tokWithoutSlippage*1e6;
        const difference = Number(cashPool) - newCashPool;
        recievedPrice = difference / SwapAmount;
        // console.log(Number(tokenPool), tokWithoutSlippage*1e6,difference, recievedPrice, "math");
      } else { // tez to ctez
        initialPrice = Number(tokenPool) / Number(cashPool);
        const newCashPool = Number(cashPool) + SwapAmount * 0.9999;
        const newTokenPool = Number(tokenPool) - tokWithoutSlippage*1e6;
        const difference = Number(tokenPool) - newTokenPool;
        recievedPrice = difference / SwapAmount;
        // console.log(Number(tokenPool), tokWithoutSlippage*1e6,difference, recievedPrice, "math");
      }
      const priceImpact1 = ((initialPrice - recievedPrice) * 100) / initialPrice;
      setpriceImpact(priceImpact1);
      setMinBuyValue(formatNumberStandard(tokWithoutSlippage.toFixed(6)));
      const minRece = tokWithoutSlippage - (tokWithoutSlippage * slippage) / 100;
      setMinReceived(minRece);
    } else {
      setMinBuyValue(0);
      setMinReceived(0);
      setpriceImpact(0);
    }
  }, [cfmmStorage, formType, values.amount, slippage]);

  const rate = (): number =>
  {
    let e_rate = 1;
    if(cfmmStorage){
      const { cashPool: tokenPool, tezPool: cashPool } = cfmmStorage;
      // console.log(cashPool.toNumber(),tokenPool.toNumber() , 1000000 , target , "rate math");
    formType === FORM_TYPE.TEZ_CTEZ
    ? 
    
    e_rate = (trade_dtez_for_dcash({tez:cashPool.toNumber() , cash:tokenPool.toNumber() , dtez: 1000000 , target , rounds: 4})*9999/10000)/1e6
    // formatNumberStandard(baseStats?.currentPrice ?? 1)
    : e_rate = (trade_dcash_for_dtez({tez:cashPool.toNumber() , cash:tokenPool.toNumber() , dtez: 1000000 , target , rounds: 4})*9999/10000)/1e6

    }
    // console.log(e_rate,"rate")
    return formatNumberStandard(e_rate);
    
  }

  const { buttonText, errorList } = useMemo(() => {
    const errorListLocal = Object.values(errors);
    if (!userAddress) {
      return { buttonText: BUTTON_TXT.CONNECT, errorList: errorListLocal };
    }
    if (values.amount) {
      if (errorListLocal.length > 0) {
        return { buttonText: errorListLocal[0], errorList: errorListLocal };
      }

      return { buttonText: BUTTON_TXT.SWAP, errorList: errorListLocal };
    }

    return { buttonText: BUTTON_TXT.ENTER_AMT, errorList: errorListLocal };
  }, [errors, userAddress, values.amount]);

  return (
    <form autoComplete="off" onSubmit={handleSubmit}>
      <FormControl id="from-input-amount">
        <FormLabel color={text2} fontSize="xs">
          From
        </FormLabel>
        <InputGroup>
          <Input
            name="amount"
            id="amount"
            type="text"
            placeholder="0.0"
            color={text2}
            bg={inputbg}
            value={inputFormatNumberStandard(values.amount)}
            onChange={handleChange}
            lang="en-US"
          />
          {getRightElement(formType === FORM_TYPE.CTEZ_TEZ ? TOKEN.CTez : TOKEN.Tez)}
        </InputGroup>
        <Text color={text4} fontSize="xs" mt={1}>
          Balance:{' '}
          {formType === FORM_TYPE.CTEZ_TEZ
            ? formatNumberStandard(balance?.ctez)
            : formatNumberStandard(balance?.xtz)}{' '}
          <Text
            as="span"
            cursor="pointer"
            color={maxColor}
            onClick={() =>
              formik.setFieldValue(
                'amount',
                formType === FORM_TYPE.CTEZ_TEZ
                  ? formatNumberStandard(balance?.ctez)
                  : formatNumberStandard(balance?.xtz),
              )
            }
          >
            (Max)
          </Text>
        </Text>
      </FormControl>

      <Flex justifyContent="center" mt={2}>
        <IconButton
          variant="ghost"
          size="4xl"
          borderRadius="50%"
          p={2}
          sx={{
            transition: 'transform 0s',
          }}
          _hover={{
            transform: 'rotate(180deg)',
            transition: 'transform 0.5s',
          }}
          aria-label="Swap Token"
          icon={<MdSwapVert />}
          onClick={() =>
            setFormType(formType === FORM_TYPE.CTEZ_TEZ ? FORM_TYPE.TEZ_CTEZ : FORM_TYPE.CTEZ_TEZ)
          }
        />
      </Flex>

      <FormControl id="to-input-amount" mt={0} mb={6}>
        <FormLabel color={text2} fontSize="xs">
          To
        </FormLabel>
        <InputGroup>
          <Input
            isReadOnly
            color={text2}
            bg={inputbg}
            value={formatNumberStandard(minBuyValue || '')}
            placeholder="0.0"
            type="text"
            lang="en-US"
          />
          {getRightElement(formType === FORM_TYPE.CTEZ_TEZ ? TOKEN.Tez : TOKEN.CTez)}
        </InputGroup>
        <Text color={text4} fontSize="xs" mt={1}>
          Balance:{' '}
          {formType === FORM_TYPE.CTEZ_TEZ
            ? formatNumberStandard(balance?.xtz)
            : formatNumberStandard(balance?.ctez)}
        </Text>
      </FormControl>

      <Flex justifyContent="space-between">
        <Text fontSize="xs">Rate</Text>
        <Text color={text2} fontSize="xs">
          1 {formType === FORM_TYPE.CTEZ_TEZ ? 'ctez' : 'tez'} = {rate()}{' '}
          {formType === FORM_TYPE.CTEZ_TEZ ? 'tez' : 'ctez'}
        </Text>
      </Flex>
      <Flex justifyContent="space-between">
        <Text fontSize="xs">Min Received</Text>
        <Text color={text2} fontSize="xs">
          {formatNumberStandard(Number(minReceived))}{' '}
          {formType === FORM_TYPE.CTEZ_TEZ ? 'tez' : 'ctez'}
        </Text>
      </Flex>
      <Flex justifyContent="space-between">
        <Text fontSize="xs">Price Impact</Text>
        <Text color={text2} fontSize="xs">
          {formatNumberStandard(Number(priceImpact))} %
        </Text>
      </Flex>

      <Button
        walletGuard
        width="100%"
        mt={4}
        p={6}
        type="submit"
        disabled={isSubmitting || errorList.length > 0}
        isLoading={isSubmitting}
        leftIcon={buttonText === BUTTON_TXT.CONNECT ? <MdAdd /> : undefined}
      >
        {buttonText}
      </Button>
    </form>
  );
};

export { Swap };
