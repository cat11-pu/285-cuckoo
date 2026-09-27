// app.js：渲染结果
import { slotsFor, isFree } from "./cuckoo.js";
import { step, close } from "./cuckoorun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { events: events, budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      t1: state.t1, t2: state.t2, evicted: state.evicted, ledger: state.ledger,
      applied: state.applied.length
    });
  };
  return { tables: [closed.state.t1.slice(), closed.state.t2.slice()],
           evicted: closed.state.evicted.slice(),
           inserted_first: first.inserted, inserted_wide: wide.inserted,
           pair_differs: first.inserted !== wide.inserted,
           ledger_before: first.ledger_before, ledger: first.ledger,
           catchup: closed.catchup, ledger_after: closed.state.ledger.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.inserted, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count: events.length,
           tail: slotsFor("a", 3)[0] + (isFree([[], []], 0) ? 1 : 0) };
}
