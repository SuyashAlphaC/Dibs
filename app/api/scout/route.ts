import {NextResponse} from "next/server";
import {getScoutDashboard} from "@/lib/live-markets";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({source: "demo", dashboard: null});
  }

  const dashboard = await getScoutDashboard(address);
  return NextResponse.json({source: dashboard ? "envio" : "demo", dashboard});
}
