import {NextResponse} from "next/server";
import {getScoutDashboard} from "@/lib/live-markets";
import {resolveFarcasterIdentities} from "@/lib/farcaster";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({source:"invalid",dashboard:null,error:"A valid scout address is required."},{status:400});
  }

  const [dashboard,identities] = await Promise.all([getScoutDashboard(address),resolveFarcasterIdentities([address])]);
  if(!dashboard)return NextResponse.json({source:"unavailable",dashboard:null,error:"The live Envio scout index is temporarily unavailable."},{status:503});
  return NextResponse.json({source:"envio",dashboard,identity:identities.get(address.toLowerCase())});
}
