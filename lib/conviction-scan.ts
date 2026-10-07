import type {ConvictionReport, IntelligenceChain} from "./conviction-intelligence";

export type ScanState = {chain: IntelligenceChain; reports: Partial<Record<IntelligenceChain, ConvictionReport>>; busy: boolean; error: string; retryAt: number};
export type ScanAction = {type: "select"; chain: IntelligenceChain} | {type: "start"} | {type: "result"; report: ConvictionReport; retryAt: number} | {type: "failure"; error: string; retryAt?: number};
export function scanState(initial?: ConvictionReport): ScanState {
  return {chain: initial?.chain ?? "monad", reports: initial ? {[initial.chain]: initial} : {}, busy: false, error: "", retryAt: 0};
}
export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case "select": return state.busy ? state : {...state, chain: action.chain, error: ""};
    case "start": return {...state, busy: true, error: ""}; // Keep the last report visible during retries.
    case "result": return {...state, reports: {...state.reports, [action.report.chain]: action.report}, busy: false, error: "", retryAt: action.retryAt};
    case "failure": return {...state, busy: false, error: action.error, retryAt: action.retryAt ?? state.retryAt};
  }
}
export function scanRetryDeadline(retryAfter: string | null, now: number) {
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 3600 ? now + seconds * 1000 : 0;
}
export function scanSecondsRemaining(retryAt: number, now: number) { return Math.max(0, Math.ceil((retryAt - now) / 1000)); }
