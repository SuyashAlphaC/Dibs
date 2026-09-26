import {notFound} from "next/navigation";
import {MarketDetail} from "@/components/market/market-detail";
import {findMarket} from "@/lib/mock/markets";
import {getLiveMarket} from "@/lib/live-markets";

export default async function MarketPage({params}: {params:Promise<{marketId:string}>}) {
  const {marketId}=await params;
  const market=(await getLiveMarket(marketId)) ?? findMarket(marketId);
  if(!market) notFound();
  return <MarketDetail market={market}/>;
}
