import fs from "node:fs";
import { slotsFor, isFree } from "./cuckoo.js";
import { step, close } from "./cuckoorun.js";

// 验收断言：上面每条值收进 emit，最后与期望值逐项比对，不符就非零退出。
const __lines = [];
function emit(label, value) { __lines.push([String(label).replace(/ =$/, ""), value]); }


const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/keys.json", "utf8"));
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

emit("收尾后第一张表 =", JSON.stringify(closed.state.t1));
emit("收尾后第二张表 =", JSON.stringify(closed.state.t2));
emit("收尾后被踢出序列 =", JSON.stringify(closed.state.evicted));
emit("首轮插入个数 =", first.inserted);
emit("二档插入个数 =", wide.inserted);
emit("两个预算档插入不同 =", first.inserted !== wide.inserted);
emit("收尾前待插入账 =", first.ledger_before);
emit("压在账上的键 =", JSON.stringify(first.ledger));
emit("收尾补齐个数 =", closed.catchup);
emit("收尾后待插入账 =", closed.state.ledger.length);
emit("拆两轮中间态不同 =", fingerprint(r2.state) !== fingerprint(first.state));
emit("拆两轮收尾态一致 =", fingerprint(closedTwo.state) === fingerprint(closed.state));
emit("重放新插入 =", replay.inserted);
emit("工作计数未超上界 =", first.judged <= first.judged_bound);
emit("与全量对照差异 =", fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1);


// ---- 异常路径探针：真调用实现，看它报出什么码（不是从样例里抄）----
try {
  step(Object.assign({}, { budget: 2, capacity: 3,
    state: { t1: [null, null, null], t2: [null, null, null], evicted: [], ledger: [], applied: [] },
    events: [{ id: 1, kind: "put", name: "" }] }));
  emit("空键报码", "没有报错");
} catch (error) {
  emit("空键报码", error && error.code ? error.code : String(error.message));
}
try {
  step(Object.assign({}, { budget: 2, capacity: 0,
    state: { t1: [], t2: [], evicted: [], ledger: [], applied: [] },
    events: [{ id: 1, kind: "put", name: "a" }] }));
  emit("容量不合法报码", "没有报错");
} catch (error) {
  emit("容量不合法报码", error && error.code ? error.code : String(error.message));
}
try {
  step(Object.assign({}, { budget: 2, capacity: 3,
    state: { t1: ["a", null, null], t2: [null, null, null], evicted: [], ledger: [], applied: [] },
    events: [{ id: 1, kind: "put", name: "a" }] }));
  emit("重复键报码", "没有报错");
} catch (error) {
  emit("重复键报码", error && error.code ? error.code : String(error.message));
}
try {
  step(Object.assign({}, { budget: 2, capacity: 3,
    state: { t1: [null, null, null], t2: [null, null, null], evicted: [], ledger: [], applied: [] },
    events: [{ id: 1, kind: "peek", name: "a" }] }));
  emit("事件不合法报码", "没有报错");
} catch (error) {
  emit("事件不合法报码", error && error.code ? error.code : String(error.message));
}


// ---- 期望值（参考模型算出，与题面给的验收数值一致）----
const EXPECTED = {
  "收尾后第一张表": [
    "c",
    "a",
    "e"
  ],
  "收尾后第二张表": [
    null,
    "d",
    null
  ],
  "收尾后被踢出序列": [
    "b"
  ],
  "首轮插入个数": 2,
  "二档插入个数": 4,
  "两个预算档插入不同": true,
  "收尾前待插入账": 3,
  "压在账上的键": [
    "c",
    "d",
    "e"
  ],
  "收尾补齐个数": 3,
  "收尾后待插入账": 0,
  "拆两轮中间态不同": true,
  "拆两轮收尾态一致": true,
  "重放新插入": 0,
  "工作计数未超上界": true,
  "与全量对照差异": 0,
  "空键报码": "E_BAD_KEY",
  "容量不合法报码": "E_BAD_CAPACITY",
  "重复键报码": "E_DUPLICATE_KEY",
  "事件不合法报码": "E_BAD_EVENT"
};
// 有的值在收进来之前已经 stringify 过，比较前先试着解析回来，避免类型错配把正确实现判成不过。
function __same(got, want) {
  if (typeof got === "string") {
    try { const parsed = JSON.parse(got); if (JSON.stringify(parsed) === JSON.stringify(want)) return true; } catch (error) { /* 不是 JSON 就按原文比 */ }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  const got = found[1];
  if (__same(got, want)) { console.log("一致 " + label + " = " + JSON.stringify(got)); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(got)); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
