import { useSyncExternalStore } from 'react';

export interface ToastState {
  id: number;
  message: string;
  undo?: () => Promise<unknown>;
}

const SHOW_MS = 6000;
let current: ToastState | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const listeners = new Set<() => void>();

function set(next: ToastState | null) {
  current = next;
  clearTimeout(timer);
  if (next) timer = setTimeout(() => set(null), SHOW_MS);
  listeners.forEach((l) => l());
}

/** Show a short confirmation, optionally with Undo. Replaces any toast already showing. */
export function showToast(message: string, undo?: () => Promise<unknown>): void {
  set({ id: ++seq, message, undo });
}

export function dismissToast(): void {
  set(null);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useToast(): ToastState | null {
  return useSyncExternalStore(subscribe, () => current);
}
