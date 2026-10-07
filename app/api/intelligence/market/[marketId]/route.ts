import {NextResponse} from "next/server";
import {authenticateScout} from "@/lib/privy-auth";
import {getMarketConviction} from "@/lib/live-markets";
import {analyzeMarketConviction, nansenIntegrationStatus} from "@/lib/nansen-service";
import {createScanLimiter, intelligenceSameOrigin, parseIntelligenceRequest} from "@/lib/intelligence-request";

export const dynamic = "force-dynamic";
export const maxDuration = 45;
const limit = createScanLimiter();
const headers = {"cache-control": "no-store"};

// Configuration status only. Page visits and crawlers never trigger paid Nansen calls.
export async function GET() {
  return NextResponse.json(nansenIntegrationStatus(), {headers});
}

export async function POST(request: Request, {params}: {params: Promise<{marketId: string}>}) {
  if (!intelligenceSameOrigin(request)) return NextResponse.json({error: "Cross-site scans are not allowed"}, {status: 403, headers});
  const status = nansenIntegrationStatus();
  if (!status.enabled || !status.configured) return NextResponse.json({error: "Nansen intelligence is not enabled and configured on this deployment"}, {status: 503, headers});
  let user;
  try { user = await authenticateScout(request); }
  catch { return NextResponse.json({error: "Sign in with Privy and link Farcaster to run a Nansen scan"}, {status: 401, headers}); }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 256) throw new Error("Body exceeds budget");
    body = JSON.parse(text);
  } catch { return NextResponse.json({error: "Invalid scan request"}, {status: 400, headers}); }
  const parsed = parseIntelligenceRequest((await params).marketId, body);
  if (!parsed) return NextResponse.json({error: "Choose an indexed market and Monad, Base or Ethereum context"}, {status: 400, headers});
  const retry = limit(user.userId);
  if (retry) return NextResponse.json({error: `Wait ${retry} seconds before another scan`}, {status: 429, headers: {...headers, "retry-after": String(retry)}});
  try {
    const indexed = await getMarketConviction(parsed.marketId);
    if (!indexed) return NextResponse.json({error: "Envio conviction data is unavailable; no wallet context was inferred"}, {status: 503, headers});
    if (!indexed.exists) return NextResponse.json({error: "No indexed market exists at this ID"}, {status: 404, headers});
    const report = await analyzeMarketConviction(parsed.marketId, parsed.chain, indexed.positions);
    console.info(JSON.stringify({event: "nansen_conviction_scan", marketId: parsed.marketId, chain: parsed.chain, status: report.status, queried: report.coverage.queried, succeeded: report.coverage.succeeded, linkedBackers: report.linkedBackers}));
    return NextResponse.json({report}, {status: report.status === "unavailable" ? 503 : 200, headers});
  } catch {
    return NextResponse.json({error: "Conviction analysis is unavailable; no conclusions were inferred"}, {status: 503, headers});
  }
}
