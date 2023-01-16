import { ProSidebar, SidebarHeader, SidebarContent, Menu, MenuItem } from 'react-pro-sidebar';
import clsx from 'clsx';
import { Text, Flex, Box, Image } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ReactComponent as MyOvens } from '../../assets/images/sidebar/myovens.svg';
import { ReactComponent as AllOvens } from '../../assets/images/sidebar/allovens.svg';
import { ReactComponent as CreateOven } from '../../assets/images/sidebar/createoven.svg';
import { ReactComponent as Trade } from '../../assets/images/sidebar/trade.svg';
import { ReactComponent as Faq } from '../../assets/images/sidebar/faq.svg';
import { ReactComponent as Analytics } from '../../assets/images/sidebar/analytics-icon.svg';
import { ReactComponent as Github } from '../../assets/images/sidebar/github.svg';
import BenderLabs from '../../assets/images/sidebar/bender-labs.png';
import { ReactComponent as Plenty } from '../../assets/images/sidebar/plenty.svg';
import { ReactComponent as ArrowLeft } from '../../assets/images/sidebar/arrowleft.svg';
import { ReactComponent as ArrowRight } from '../../assets/images/sidebar/arrowright.svg';
import { ReactComponent as Logo } from '../../assets/images/sidebar/ctez.svg';
import 'react-pro-sidebar/dist/css/styles.css';
import { openModal } from '../../redux/slices/UiSlice';
import { MODAL_NAMES } from '../../constants/modals';
import { useCfmmStorage, useCtezBaseStats } from '../../api/queries';
import { useThemeColors } from '../../hooks/utilHooks';
import { formatNumberStandard } from '../../utils/numbers';

export interface Props {
  handleCollapsed: React.MouseEventHandler;
  handleToggled: ((value: boolean) => void) | undefined;
  collapsed: boolean;
  toggled: boolean;
}

const Sidebar: React.FC<Props> = ({ handleCollapsed, handleToggled, collapsed, toggled }) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { data } = useCtezBaseStats();
  const [ctezCFMMsupply, setCtezCFMMsupply] = useState("");

  const [sideBarBackground, sidebarTxt, sidebarTopic] = useThemeColors([
    'sideBarBg',
    'sidebarTxt',
    'sidebarTopic',
  ]);

  const handleCreateOvenClick = () => {
    dispatch(openModal(MODAL_NAMES.CREATE_OVEN));
  };
  const [rate,setRate] = useState(1);
  const { data: cfmmStorage } = useCfmmStorage();
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

const rateCalc = (): number =>
{
  let e_rate = 1;
  if(cfmmStorage){
    
    const { cashPool: tokenPool, tezPool: cashPool } = cfmmStorage;
    const supply = (tokenPool.toNumber() / cfmmStorage.lqtTotal.toNumber())*100
    setCtezCFMMsupply(supply.toFixed(6))
    e_rate = (trade_dtez_for_dcash({tez:cashPool.toNumber() , cash:tokenPool.toNumber() , dtez: 1000000 , target:cfmmStorage.target.toNumber() , rounds: 4})*9999/10000)/1e6
  }
  return formatNumberStandard(e_rate);
  
}
useEffect(()=>{
  setRate(rateCalc())
},[cfmmStorage])


  const stats = () => {
    
        return (
      <Flex direction="column">
        <Flex direction="row">
          <Text color={sidebarTxt} fontSize="xs" cursor="default">
            Current Target
          </Text>
          <Text marginLeft="auto" color={sidebarTxt} fontSize="xs" cursor="default">
            {data?.currentTarget}
          </Text>
        </Flex>
        <Flex direction="row">
          <Text color={sidebarTxt} fontSize="xs" cursor="default">
            Current Price
          </Text>
          <Text marginLeft="auto" color={sidebarTxt} fontSize="xs" cursor="default">
            {data? rate : ""}
          </Text>
        </Flex>
        <Flex direction="row">
          <Text color={sidebarTxt} fontSize="xs" cursor="default">
            Premium
          </Text>
          <Text marginLeft="auto" color={sidebarTxt} fontSize="xs" cursor="default">
            {data?.premium}%
          </Text>
        </Flex>
        <Flex direction="row">
          <Text color={sidebarTxt} fontSize="xs" cursor="default">
            Current Annual Drift
          </Text>
          <Text marginLeft="auto" color={sidebarTxt} fontSize="xs" cursor="default">
            {data?.currentAnnualDrift}%
          </Text>
        </Flex>
        <Flex direction="row">
          <Text color={sidebarTxt} fontSize="xs" cursor="default">
          Liquidity Fee
          </Text>
          <Text marginLeft="auto" color={sidebarTxt} fontSize="xs" cursor="default">
            {data?.annual_fee}%
          </Text>
        </Flex>
        <Flex direction="row">
          <Text color={sidebarTxt} fontSize="xs" cursor="default">
          Ctez CFMM Supply
          </Text>
          <Text marginLeft="auto" color={sidebarTxt} fontSize="xs" cursor="default">
            {ctezCFMMsupply}%
          </Text>
        </Flex>
        {/* <Flex direction="row">
          <Text color={sidebarTxt} fontSize="xs" cursor="default">
            Annual Drift (Past week)
          </Text>
          <Text marginLeft="auto" color={sidebarTxt} fontSize="xs" cursor="default">
            {data?.annualDriftPastWeek}%
          </Text>
        </Flex> */}
      </Flex>
    );
  };

  return (
    <Box id="sidebar">
      <ProSidebar collapsed={collapsed} breakPoint="md" toggled={toggled} onToggle={handleToggled}>
        <Box background={sideBarBackground} flexGrow={1}>
          <SidebarHeader>
            <Flex alignItems="center" justifyContent="center" padding="16px 0px 16px 20px">
              <Box>
                <NavLink to="/">
                  <Logo width="40px" height="40px" />
                </NavLink>
              </Box>
              <Text
                flexGrow={1}
                flexShrink={1}
                overflow="hidden"
                color="white"
                fontWeight={600}
                fontSize="xl"
                marginLeft="10px"
                whiteSpace="nowrap"
                textOverflow="ellipsis"
              >
                <NavLink to="/">ctez</NavLink>
              </Text>
            </Flex>
            <Box role="button" className="menu-expand-button" onClick={handleCollapsed}>
              <Flex justifyContent="center" width="8px">
                {collapsed ? <ArrowRight /> : <ArrowLeft />}
              </Flex>
            </Box>
          </SidebarHeader>
          <SidebarContent>
            <Box height="calc(100vh - 72px)" overflow="auto">
              <Menu iconShape="square">
                <MenuItem
                  className={clsx({
                    highlight: location.pathname === '/createoven',
                  })}
                  icon={<CreateOven />}
                >
                  <NavLink to={(loc) => loc.pathname} onClick={handleCreateOvenClick}>
                    Create Oven
                  </NavLink>
                </MenuItem>
                <MenuItem
                  className={clsx({
                    highlight: location.pathname === '/ovens',
                  })}
                  icon={<AllOvens />}
                >
                  <Link to="/ovens">All Ovens</Link>
                </MenuItem>
                <MenuItem
                  className={clsx({
                    highlight: location.pathname === '/myovens',
                  })}
                  icon={<MyOvens />}
                >
                  <Link to="/myovens">My Ovens</Link>
                </MenuItem>
                <MenuItem
                  className={clsx({
                    highlight: location.pathname === '/trade',
                  })}
                  icon={<Trade />}
                >
                  <Link to="/trade">Trade</Link>
                </MenuItem>
                <MenuItem
                  className={clsx(
                    {
                      hide: collapsed,
                    },
                    'no-cursor',
                  )}
                >
                  <Text fontSize="sm" color={sidebarTopic} cursor="default">
                    Stats
                  </Text>
                </MenuItem>
                <MenuItem
                  className={clsx(
                    {
                      hide: collapsed,
                    },
                    'no-cursor',
                    'highlight',
                  )}
                >
                  {stats()}
                </MenuItem>
                <MenuItem
                  className={clsx(
                    {
                      hide: collapsed,
                    },
                    'no-cursor',
                  )}
                >
                  <Text fontSize="sm" color={sidebarTopic}>
                    Info
                  </Text>
                </MenuItem>
                {/* <MenuItem
                  className={clsx({
                    highlight: location.pathname === '/analytics',
                  })}
                  icon={<Analytics />}
                >
                  <Link to="/analytics">Analytics</Link>
                </MenuItem> */}
                <MenuItem
                  className={clsx({
                    highlight: location.pathname === '/faq',
                  })}
                  icon={<Faq />}
                >
                  <Link to="/faq">FAQ</Link>
                </MenuItem>
                <MenuItem icon={<Github />}>
                  <a href="https://github.com/Tezsure/ctez" target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </MenuItem>
                <MenuItem
                  className={clsx({
                    hide: collapsed,
                  })}
                >
                  <Text fontSize="sm" color={sidebarTopic} cursor="default">
                    Adopters
                  </Text>
                </MenuItem>
                <MenuItem icon={<Plenty />}>
                  <a href="https://www.plentydefi.com/" target="_blank" rel="noreferrer">
                    Plenty
                  </a>
                </MenuItem>
              </Menu>
            </Box>
          </SidebarContent>
        </Box>
      </ProSidebar>
    </Box>
  );
};

export { Sidebar };
