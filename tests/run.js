import assert from "node:assert";
import { slotsFor, isFree } from "../cuckoo.js";
import { step, close } from "../cuckoorun.js";
import { render } from "../app.js";

const base = {
  budget: 2, capacity: 3,
  state: { t1: [null, null, null], t2: [null, null, null], evicted: [], ledger: [], applied: [] },
  events: [],
  key_error_code: "E_BAD_KEY", capacity_error_code: "E_BAD_CAPACITY",
  duplicate_error_code: "E_DUPLICATE_KEY", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("slotsFor returns a pair", () => {
  assert.ok(Array.isArray(slotsFor("a", 3)));
});

check("isFree returns a flag", () => {
  assert.strictEqual(typeof isFree([[], []], 0), "boolean");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
