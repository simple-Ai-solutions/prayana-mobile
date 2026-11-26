// Packages picked for "Compare" on Holiday Deals: up to 3, kept in memory for
// the session (no storage, so an old pick never haunts a later visit).
import { useSyncExternalStore } from 'react';

export const MAX_COMPARE = 3;
let picked: string[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toggleCompare(id: string): 'added' | 'removed' | 'full' {
  if (picked.includes(id)) {
    picked = picked.filter((x) => x !== id);
    emit();
    return 'removed';
  }
  if (picked.length >= MAX_COMPARE) return 'full';
  picked = [...picked, id];
  emit();
  return 'added';
}

export function clearCompare() {
  picked = [];
  emit();
}

export function useComparePicks(): string[] {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => picked,
  );
}
