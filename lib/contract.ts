import {defineChain, encodeFunctionData, parseEther} from "viem";

const configuredChainId=Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??143);
const configuredRpcUrl=process.env.NEXT_PUBLIC_MONAD_RPC_URL??(configuredChainId===10143?"https://testnet-rpc.monad.xyz":"https://rpc.monad.xyz");

export const monad = defineChain({
  id: configuredChainId,
  name: configuredChainId===10143?"Monad Testnet":"Monad",
  nativeCurrency: {name: "MON", symbol: "MON", decimals: 18},
  rpcUrls: {default: {http: [configuredRpcUrl]}},
});

export const dibsAbi = [
  {
    type: "function",
    name: "scout",
    stateMutability: "payable",
    inputs: [
      {name: "marketId", type: "uint256"},
      {name: "units", type: "uint256"},
    ],
    outputs: [],
  },
] as const;

export function nextUnitCost(totalUnits: number) {
  return 0.01 + totalUnits * 0.001;
}

export function scoutTransaction(marketId: number, totalUnits: number) {
  const address = process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as `0x${string}` | undefined;
  if (!address) return null;
  const cost = nextUnitCost(totalUnits);
  return {
    to: address,
    data: encodeFunctionData({abi: dibsAbi, functionName: "scout", args: [BigInt(marketId), 1n]}),
    value: parseEther(cost.toFixed(3)),
  };
}
