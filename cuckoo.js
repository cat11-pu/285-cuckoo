// cuckoo.js：两个候选槽位与空槽判定
export function slotsFor(name, capacity) {
  let sum = 0;
  for (const ch of String(name)) sum += ch.charCodeAt(0);
  return [sum % capacity, (3 * sum + 1) % capacity];
}

export function isFree(tables, slot) {
  if (Array.isArray(tables) && Array.isArray(tables[0])) {
    return tables.every((row) => row[slot] == null);
  }
  return tables == null || tables[slot] == null;
}
