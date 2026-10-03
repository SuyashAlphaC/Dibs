import {formatEther,parseEther} from "viem";

const DEFAULT_MAX_SEED_MON="0.05";
const DEFAULT_MIN_BALANCE_MON="0.5";

function enabled(value:string|undefined){return value?.trim().toLowerCase()==="true";}

function parseNonNegativeMon(name:string,value:string){
  if(!/^\d+(?:\.\d{1,18})?$/.test(value))throw new Error(`${name} must be a non-negative MON amount`);
  return parseEther(value);
}

export type MarketAutomationPolicy={
  automationEnabled:boolean;
  openingEnabled:boolean;
  publicNominationsEnabled:boolean;
  epochSeed:bigint;
  maxEpochSeed:bigint;
  minOperatorBalance:bigint;
  maxMarketsPerRun:number;
  publicEpochMarketCap:number;
};

export function marketAutomationPolicy(env:Record<string,string|undefined>=process.env):MarketAutomationPolicy{
  const epochSeed=parseNonNegativeMon("MARKET_EPOCH_SEED_MON",env.MARKET_EPOCH_SEED_MON??"0");
  const maxEpochSeed=parseNonNegativeMon("MARKET_MAX_EPOCH_SEED_MON",env.MARKET_MAX_EPOCH_SEED_MON??DEFAULT_MAX_SEED_MON);
  const minOperatorBalance=parseNonNegativeMon("MARKET_MIN_OPERATOR_BALANCE_MON",env.MARKET_MIN_OPERATOR_BALANCE_MON??DEFAULT_MIN_BALANCE_MON);
  const maxMarketsPerRun=Math.floor(Number(env.MAX_MARKETS_PER_RUN??4));
  const publicEpochMarketCap=Math.floor(Number(env.PUBLIC_NOMINATION_MARKET_CAP??12));
  if(epochSeed>maxEpochSeed)throw new Error(`MARKET_EPOCH_SEED_MON exceeds the ${formatEther(maxEpochSeed)} MON safety cap`);
  if(!Number.isSafeInteger(maxMarketsPerRun)||maxMarketsPerRun<1||maxMarketsPerRun>10)throw new Error("MAX_MARKETS_PER_RUN must be between 1 and 10");
  if(!Number.isSafeInteger(publicEpochMarketCap)||publicEpochMarketCap<1||publicEpochMarketCap>50)throw new Error("PUBLIC_NOMINATION_MARKET_CAP must be between 1 and 50");
  return {
    automationEnabled:enabled(env.MARKET_AUTOMATION_ENABLED),
    openingEnabled:enabled(env.MARKET_OPENING_ENABLED),
    publicNominationsEnabled:enabled(env.PUBLIC_NOMINATIONS_ENABLED),
    epochSeed,maxEpochSeed,minOperatorBalance,maxMarketsPerRun,publicEpochMarketCap,
  };
}

export function assertOperatorCanSpend(balance:bigint,policy:Pick<MarketAutomationPolicy,"epochSeed"|"minOperatorBalance">){
  const required=policy.epochSeed+policy.minOperatorBalance;
  if(balance<required)throw new Error(`Operator balance guard: ${formatEther(balance)} MON is below the ${formatEther(required)} MON required balance`);
}
