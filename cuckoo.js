// cuckoo.js：两个槽位与占位判定（基线：一律给零号槽、一律说空着）
export function slotsFor(name, capacity) {
  return [0, 0];
}

export function isFree(tables, slot) {
  return true;
}
