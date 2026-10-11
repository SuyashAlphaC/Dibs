import assert from "node:assert/strict";
import {mock, test} from "node:test";
import {collectQualifiedInteractions, NeynarCastNotFound} from "./neynar-observations";

const hash = `0x${"a".repeat(40)}`;

test("a cast-specific Neynar 404 is distinguished from a temporary provider failure", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    return path.endsWith("/cast/conversation/")
      ? Response.json({message: `cast with type hash and identifier ${hash} not found`}, {status: 404})
      : Response.json({reactions: [], next: {cursor: null}});
  });
  try {
    await assert.rejects(collectQualifiedInteractions(hash, 1_800_000_000, "test-key"), NeynarCastNotFound);
  } finally {
    fetchMock.mock.restore();
  }
});

test("an unrelated Neynar 404 remains a provider error", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    return path.endsWith("/cast/conversation/")
      ? Response.json({message: "route not found"}, {status: 404})
      : Response.json({reactions: [], next: {cursor: null}});
  });
  try {
    await assert.rejects(collectQualifiedInteractions(hash, 1_800_000_000, "test-key"), /Neynar \/v2\/farcaster\/cast\/conversation\/ returned 404/);
  } finally {
    fetchMock.mock.restore();
  }
});
