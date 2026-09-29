import {NextResponse} from "next/server";
import {getScoutLeaderboard} from "@/lib/live-markets";

export async function GET(){
  const scouts=await getScoutLeaderboard();
  return NextResponse.json({source:scouts?"envio":"unavailable",scouts:scouts??[]});
}
