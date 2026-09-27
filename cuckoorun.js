// cuckoorun.js：按插入预算插入并留账（基线：一律给空表）
import { slotsFor, isFree } from "./cuckoo.js";

export function step(spec) {
  return { state: spec.state, inserted: 0, ledger_before: 0, ledger: [], judged: 0, judged_bound: 0 };
}

export function close(spec) {
  return { state: spec.state, catchup: 0 };
}
