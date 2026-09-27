// cuckoorun.js：按插入预算插入并留账，收尾不限预算补齐
import { slotsFor, isFree } from "./cuckoo.js";

function fail(spec, key, fallback, message) {
  const error = new Error(message);
  error.code = (spec && spec[key]) || fallback;
  throw error;
}

function validCapacity(capacity) {
  return Number.isInteger(capacity) && capacity > 0;
}

function cloneState(src) {
  src = src || {};
  return {
    t1: Array.isArray(src.t1) ? src.t1.slice() : [],
    t2: Array.isArray(src.t2) ? src.t2.slice() : [],
    evicted: Array.isArray(src.evicted) ? src.evicted.slice() : [],
    ledger: Array.isArray(src.ledger) ? src.ledger.slice() : [],
    applied: Array.isArray(src.applied) ? src.applied.slice() : []
  };
}

function place(state, name, capacity) {
  const slots = slotsFor(name, capacity);
  const first = slots[0];
  const wide = slots[1];
  if (isFree(state.t1, first)) {
    state.t1[first] = name;
  } else if (isFree(state.t2, wide)) {
    state.t2[wide] = name;
  } else {
    state.evicted.push(state.t1[first]);
    state.t1[first] = name;
  }
}

function knownKey(state, name) {
  return state.t1.includes(name) || state.t2.includes(name)
    || state.ledger.includes(name) || state.evicted.includes(name);
}

export function step(spec) {
  spec = spec || {};
  const events = spec.events || [];
  if (!Array.isArray(events)) fail(spec, "event_error_code", "E_BAD_EVENT", "事件表必须是数组");
  if (!validCapacity(spec.capacity)) {
    fail(spec, "capacity_error_code", "E_BAD_CAPACITY", "容量必须是正整数");
  }

  const state = cloneState(spec.state);
  let remaining = Number.isInteger(spec.budget) ? spec.budget : 0;
  let inserted = 0;

  const backlog = state.ledger.slice();
  state.ledger.length = 0;
  let cursor = 0;
  while (cursor < backlog.length && remaining > 0) {
    place(state, backlog[cursor], spec.capacity);
    cursor += 1;
    remaining -= 1;
    inserted += 1;
  }
  while (cursor < backlog.length) {
    state.ledger.push(backlog[cursor]);
    cursor += 1;
  }

  let judged = 0;
  for (const event of events) {
    judged += 1;
    if (!event || typeof event !== "object" || event.kind !== "put") {
      fail(spec, "event_error_code", "E_BAD_EVENT", "只支持 put 事件");
    }
    const token = event.id != null ? event.id : event.name;
    if (state.applied.includes(token)) continue;

    const name = event.name;
    if (typeof name !== "string" || name.length === 0) {
      fail(spec, "key_error_code", "E_BAD_KEY", "键名不能为空");
    }
    if (knownKey(state, name)) {
      fail(spec, "duplicate_error_code", "E_DUPLICATE_KEY", "键已经存在：" + name);
    }

    state.applied.push(token);
    if (remaining > 0) {
      place(state, name, spec.capacity);
      remaining -= 1;
      inserted += 1;
    } else {
      state.ledger.push(name);
    }
  }

  return {
    state,
    inserted,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  spec = spec || {};
  if (!validCapacity(spec.capacity)) {
    fail(spec, "capacity_error_code", "E_BAD_CAPACITY", "容量必须是正整数");
  }
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const name = state.ledger.shift();
    place(state, name, spec.capacity);
    catchup += 1;
  }
  return { state, catchup };
}
