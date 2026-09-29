import assert from "node:assert/strict";
import test from "node:test";
import {formatAgeMinutes} from "./time";

test("cast age is formatted as readable minutes, hours, and days", () => {
  assert.equal(formatAgeMinutes(28), "28m");
  assert.equal(formatAgeMinutes(60), "1h");
  assert.equal(formatAgeMinutes(1_164), "19h 24m");
  assert.equal(formatAgeMinutes(1_500), "1d 1h");
});
