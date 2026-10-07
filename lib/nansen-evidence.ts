import captured from "../evidence/nansen/market-32-base-live.json";
import type {ConvictionReport} from "./conviction-intelligence";

// Retained operator capture, not a live API response or a replacement for a user scan.
export const nansenFieldReport = captured as ConvictionReport;
export const hasNansenFieldEvidence = captured.source === "nansen"
  && captured.captureMethod === "operator-cli" && captured.historicalSnapshot === true
  && captured.coverage.succeeded > 0 && captured.queries.some(query => Boolean(query.requestId));
