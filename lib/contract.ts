import {createPublicClient, defineChain, encodeFunctionData, http} from "viem";

const configuredChainId=Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??143);
const configuredRpcUrl=process.env.NEXT_PUBLIC_MONAD_RPC_URL??(configuredChainId===10143?"https://testnet-rpc.monad.xyz":"https://rpc.monad.xyz");

export const monad = defineChain({
  id: configuredChainId,
  name: configuredChainId===10143?"Monad Testnet":"Monad",
  nativeCurrency: {name: "MON", symbol: "MON", decimals: 18},
  rpcUrls: {default: {http: [configuredRpcUrl]}},
});

export const monadClient = createPublicClient({
  chain: monad,
  transport: http(configuredRpcUrl),
});

export const dibsAbi = [
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [
      {name: "marketId", type: "uint256"},
      {name: "units", type: "uint256"},
    ],
    outputs: [{name: "", type: "uint256"}],
  },
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

export async function scoutTransaction(marketId: string | number | bigint) {
  const address = process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as `0x${string}` | undefined;
  if (!address) return null;
  const id = BigInt(marketId);
  const cost = await monadClient.readContract({
    address,
    abi: dibsAbi,
    functionName: "quote",
    args: [id, 1n],
  });
  return {
    to: address,
    data: encodeFunctionData({abi: dibsAbi, functionName: "scout", args: [id, 1n]}),
    value: cost,
  };
}
