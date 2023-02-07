import BigNumber from 'bignumber.js';

export interface AddLiquidityParams {
  owner: string;
  deadline: Date;
  minLqtMinted: number;
  maxCashDeposited: number;
  amount: number;
}

export interface RemoveLiquidityParams {
  to: string;
  deadline: Date;
  lqtBurned: number;
  minTezWithdrawn: number;
  minCashWithdrawn: number;
}

export interface TezToCashParams {
  to: string;
  minCashBought: number;
  deadline: Date;
  rounds: number;
  amount: number;
  // cashSold: number; # For !CASH_IS_TEZ
}

export interface CashToTezParams {
  to: string;
  cashSold: number;
  minTezBought: number;
  deadline: Date;
  rounds: number;
}

export interface TezToTokenParams {
  outputCfmmContract: string;
  minTokensBought: number;
  to: string;
  deadline: Date;
  rounds: number;
}

export interface CfmmFA12Storage {
  admin : string;
  total_supply : BigNumber;
}

export interface CfmmStorage {
  cashPool: BigNumber;
  tezPool: BigNumber;
  ctez_address: string;
  lqtAddress: string;
  lastOracleUpdate: Date;
  consumerEntrypoint: string;
  lqtTotal: BigNumber;
  target: BigNumber;
  cashAddress: string;
}

export interface UserLQTData {
  lqt: number;
  lqtShare: number;
}
