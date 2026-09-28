import {notFound} from "next/navigation";
import {MarketDetail} from "@/components/market/market-detail";
import {findMarket} from "@/lib/mock/markets";
import {getLiveMarket,getMarketPositions} from "@/lib/live-markets";

export default async function MarketPage({params}: {params:Promise<{marketId:string}>}) {
  const {marketId}=await params;
  const [liveMarket,positions]=await Promise.all([getLiveMarket(marketId),getMarketPositions(marketId)]);
  const market=liveMarket ?? findMarket(marketId);
  if(!market) notFound();
  return <MarketDetail market={market} positions={positions??[]}/>;
}
