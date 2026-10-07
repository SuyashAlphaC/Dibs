import {buildConvictionReport, type WalletContext} from "./conviction-intelligence";

const addresses = ["1", "2", "3"].map(digit => `0x${digit.repeat(40)}`);
const fetchedAt = "2026-10-07T12:00:00Z";
const context: WalletContext = {address: addresses[0], chain: "base", fetchedAt, requestId: "fixture-not-a-provider-request", creditsUsed: null, truncated: false, relations: [{address: addresses[1], relation: "Example transfer relationship", transactionHash: `0x${"a".repeat(64)}`, timestamp: fetchedAt, chain: "base"}]};
const common = {address: `0x${"4".repeat(40)}`, relation: "Example shared service relationship", transactionHash: `0x${"b".repeat(64)}`, timestamp: fetchedAt, chain: "base" as const};

/** Isolated teaching fixture. Never merged into a real market or recorded as Nansen evidence. */
export const convictionFixture = buildConvictionReport({marketId: "example", chain: "base", source: "fixture", now: fetchedAt, positions: addresses.map((address, index) => ({address, spentWei: ["6000000000000000", "3000000000000000", "1000000000000000"][index], units: 1, leadMinutes: [2, 8, 15][index]})), queries: [{address: addresses[0], context: {...context, relations: [...context.relations, common]}}, {address: addresses[1], context: {...context, address: addresses[1], relations: [{...common, transactionHash: `0x${"c".repeat(64)}`}]}}, {address: addresses[2], error: "fixture-example-of-missing-coverage"}]});
