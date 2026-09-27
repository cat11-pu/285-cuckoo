// cuckoo.js：两个候选槽位与占位判定
// 槽位一：键名字符码之和取模；槽位二：和三倍加一再取模。
export function slotsFor(name, capacity) {
  let sum = 0;
  for (const ch of String(name)) {
    sum += ch.charCodeAt(0);
  }
  return [sum % capacity, (sum * 3 + 1) % capacity];
}

// 判指定槽位是否为空（null 即空槽）。
export function isFree(tables, slot) {
  return tables.every(function (table) {
    return table[slot] === null || table[slot] === undefined;
  });
}
