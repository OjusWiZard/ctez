import axios from 'axios';
import BigNumber from 'bignumber.js';
import { sub, format, differenceInDays } from 'date-fns';
import { getCfmmFA12Storage, getCfmmStorage, getLQTContractStorage } from '../contracts/cfmm';
import { getCtezStorage } from '../contracts/ctez';
import { BaseStats, CTezTzktStorage, OvenBalance, UserLQTData } from '../interfaces';
import { CONTRACT_DEPLOYMENT_DATE, RPC_URL } from '../utils/globals';
import { getCTezTzktStorage, getLastBlockOfTheDay, getUserOvensAPI } from './tzkt';

export const getPrevCTezStorage = async (
  days = 7,
  userAddress?: string,
): Promise<CTezTzktStorage> => {
  const prevDate = format(sub(new Date(), { days }), 'yyyy-MM-dd');

  const lastBlock = await getLastBlockOfTheDay(prevDate, userAddress);
  const storage = await getCTezTzktStorage(lastBlock.level, userAddress);
  return storage;
};
export const getCurrentBlock = async () => {
  const response = await axios.get(`${RPC_URL}/chains/main/blocks/head`);

  return response.data.header.level;
};
export const getTimeStampOfBlock = async (block: number) => {
  const response = await axios.get(`https://api.tzkt.io/v1/blocks/${block}`);

  return response.data.timestamp;
};

export const getBaseStats = async (userAddress?: string): Promise<BaseStats> => {

  const diffInDays = differenceInDays(new Date(), new Date(CONTRACT_DEPLOYMENT_DATE));
  const prevStorageDays = diffInDays >= 7 ? 7 : diffInDays;
  const cTezStorage = await getCtezStorage();
  const cfmmStorage = await getCfmmStorage();
  const cfmmFA12Storage = await getCfmmFA12Storage();
  const cTez7dayStorage = await getPrevCTezStorage(prevStorageDays, userAddress);
  const currentLevel = await getCurrentBlock();
  const timestampCurrent = await getTimeStampOfBlock(currentLevel);
  const date_timestampCurrent = new Date(timestampCurrent);
  const timestamp_lastBlock_seconds = date_timestampCurrent.getTime() / 1000;
  const past_block = currentLevel - 20160;
  const timestampPast = await getTimeStampOfBlock(past_block);
  const datedate_timestampPast = new Date(timestampPast);
  const timestamp_past_seconds = datedate_timestampPast.getTime() / 1000;

  const prevTarget = Number(cTez7dayStorage.target) / 2 ** 48;
  const currentTarget = cTezStorage.target.toNumber() / 2 ** 48;
  const currentPrice = cfmmStorage.tezPool.toNumber() / cfmmStorage.cashPool.toNumber();
  const cashPool = cfmmStorage.cashPool.toNumber();
  const outstanding = cfmmFA12Storage.total_supply.toNumber();
  
  // Fee_r calc
  let fee = (Math.abs(outstanding - 8*cashPool)*(2**22))/outstanding;
  if (((cashPool * 16) < outstanding) || ((cashPool * 8) > outstanding)){
    fee = 2097152
  }
  console.log("cashpool check ",(cashPool * 8) ,(cashPool * 16) , outstanding)
  const d = new Date(cTezStorage.last_update).getTimezoneOffset()
  const delta = Math.abs(Date.now()- d);
  const new_fee_index = cTezStorage.fee_index.toNumber() + (delta*cTezStorage.fee_index.toNumber()*fee)/2**48 ;
  const annual_feer = Math.exp(new_fee_index / ((2**48) * 365.25 * 24 * 3600));
  const annual_fee = Math.exp(fee / ((2**48) * 365.25 * 24 * 3600));
  console.log("Liquidity Fee dif ", annual_fee, annual_feer);


  const premium = currentPrice === currentTarget ? 0 : currentPrice / currentTarget - 1.0;
  const drift = cTezStorage.drift.toNumber();
  const currentAnnualDrift = (1.0 + drift / 2 ** 48) ** (365.25 * 24 * 3600) - 1.0;
  const annualDriftPastWeek =
  (currentTarget / prevTarget) **
  ((365.25 * 24 * 3600) / (timestamp_lastBlock_seconds - timestamp_past_seconds)) -
  1.0;
  const totalLiquidity = (cfmmStorage.tezPool.toNumber() * 2) / 1e6;
  return {
    originalTarget: cTezStorage.target.toNumber(),
    currentTarget: currentTarget.toFixed(6),
    currentPrice: currentPrice.toFixed(6),
    premium: (premium * 100).toFixed(2),
    currentAnnualDrift: (currentAnnualDrift * 100).toFixed(2),
    annualDriftPastWeek: (annualDriftPastWeek * 100).toFixed(2),
    totalLiquidity: totalLiquidity.toFixed(2),
    drift,
    annual_fee: annual_fee.toFixed(6) ,
  };
};

export const getUserTezCtezData = async (userAddress: string): Promise<OvenBalance> => {
  const userOvenData = await getUserOvensAPI(userAddress);
  try {
    return userOvenData.reduce(
      (acc, cur) => ({
        tezInOvens: acc.tezInOvens + Number(cur.value.tez_balance) / 1e6,
        ctezOutstanding: acc.tezInOvens + Number(cur.value.ctez_outstanding) / 1e6,
      }),
      {
        tezInOvens: 0,
        ctezOutstanding: 0,
      },
    );
  } catch (error) {
    return {
      tezInOvens: 0,
      ctezOutstanding: 0,
    };
  }
};

export const getUserLQTData = async (userAddress: string): Promise<UserLQTData> => {
  const cfmmStorage = await getCfmmStorage();
  const lqtTokenStorage = await getLQTContractStorage();
  const userLqtBalance: BigNumber =
    (await lqtTokenStorage.tokens.get(userAddress)) ?? new BigNumber(0);
  return {
    lqt: userLqtBalance.toNumber(),
    lqtShare: Number(
      ((userLqtBalance.toNumber() / cfmmStorage.lqtTotal.toNumber()) * 100).toFixed(6),
    ),
  };
};

export const isMonthFromLiquidation = (
  outstandingCtez: number,
  target: number,
  tezBalance: number,
  currentDrift: number,
  noTargetScale?: boolean,
): boolean => {
  const scaledTarget = noTargetScale ? target : target / 2 ** 48;

  return (
    outstandingCtez *
    scaledTarget *
    (1 + currentDrift / 2 ** 48) ** ((365.25 * 24 * 3600) / 12) *
    (16 / 15) >
    tezBalance
  );
};
