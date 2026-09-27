// cuckoorun.js：按插入预算插入并留账，收尾不限预算补齐
import { slotsFor } from "./cuckoo.js";

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  throw error;
}

// 容量必须是正整数
export function validCapacity(capacity) {
  return Number.isInteger(capacity) && capacity > 0;
}

function cloneState(state, capacity) {
  const fill = function (table) {
    const copy = Array.isArray(table) ? table.slice() : [];
    while (copy.length < capacity) {
      copy.push(null);
    }
    return copy;
  };
  return {
    t1: fill(state && state.t1),
    t2: fill(state && state.t2),
    evicted: Array.isArray(state && state.evicted) ? state.evicted.slice() : [],
    ledger: Array.isArray(state && state.ledger) ? state.ledger.slice() : [],
    applied: Array.isArray(state && state.applied) ? state.applied.slice() : []
  };
}

function containsKey(state, name) {
  return state.t1.indexOf(name) !== -1 || state.t2.indexOf(name) !== -1;
}

// 放一个键：第一张表候选槽空就放，否则第二张表候选槽空就放，
// 两个都占着就把第一张表槽里的键踢进踢出清单，再放进新键。
function place(state, name, capacity) {
  const pair = slotsFor(name, capacity);
  const first = pair[0];
  const wide = pair[1];
  if (state.t1[first] === null) {
    state.t1[first] = name;
    return;
  }
  if (state.t2[wide] === null) {
    state.t2[wide] = name;
    return;
  }
  const displaced = state.t1[first];
  state.evicted.push(displaced);
  state.t1[first] = name;
}

// 按插入预算处理一轮：先压上轮的账，再依次处理本批事件。
export function step(spec) {
  const capacity = spec.capacity;
  if (!validCapacity(capacity)) {
    fail(spec.capacity_error_code || "E_BAD_CAPACITY");
  }
  let budget = Number(spec.budget);
  if (!Number.isFinite(budget)) {
    budget = 0;
  }
  budget = Math.max(0, Math.floor(budget));

  const state = cloneState(spec.state, capacity);
  const events = Array.isArray(spec.events) ? spec.events : [];
  const ledgerBefore = state.ledger.length;

  let inserted = 0;
  let judged = 0;

  function take(name) {
    judged += 1;
    if (budget > 0) {
      place(state, name, capacity);
      budget -= 1;
      inserted += 1;
    } else {
      state.ledger.push(name);
    }
  }

  // 先还上一轮压在账上的键
  const carried = state.ledger;
  state.ledger = [];
  carried.forEach(function (name) {
    take(name);
  });

  events.forEach(function (event) {
    if (!event || event.kind !== "put" || typeof event.name !== "string") {
      fail(spec.event_error_code || "E_BAD_EVENT");
    }
    const mark = event.id !== undefined && event.id !== null ? "__id:" + event.id : "__key:" + event.name;
    if (state.applied.indexOf(mark) !== -1) {
      return; // 重放：已处理过的事件不再插入
    }
    if (event.name === "") {
      fail(spec.key_error_code || "E_BAD_KEY");
    }
    if (containsKey(state, event.name)) {
      fail(spec.duplicate_error_code || "E_DUPLICATE_KEY");
    }
    state.applied.push(mark);
    take(event.name);
  });

  return {
    state: state,
    inserted: inserted,
    ledger_before: state.ledger.length,
    ledger: state.ledger.slice(),
    judged: judged,
    judged_bound: events.length + ledgerBefore
  };
}

// 收尾：不限预算把账里的键全部插入，返回补齐个数。
export function close(spec) {
  const capacity = spec.capacity;
  if (!validCapacity(capacity)) {
    fail(spec.capacity_error_code || "E_BAD_CAPACITY");
  }
  const state = cloneState(spec.state, capacity);
  const pending = state.ledger;
  state.ledger = [];
  let catchup = 0;
  pending.forEach(function (name) {
    place(state, name, capacity);
    catchup += 1;
  });
  return { state: state, catchup: catchup };
}
