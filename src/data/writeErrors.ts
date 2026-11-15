import { useSyncExternalStore } from 'react';

let errors: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function reportWriteError(message: string) {
  errors = [...errors, message];
  emit();
}

export function clearWriteErrors() {
  errors = [];
  emit();
}

// Escrituras lanzadas y aún no resueltas (también cubre borrados, que hasPendingWrites no refleja).
let inFlight = 0;

export function writeStarted() {
  inFlight += 1;
  emit();
}

export function writeSettled() {
  inFlight = Math.max(0, inFlight - 1);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useWriteErrors = () => useSyncExternalStore(subscribe, () => errors);
export const usePendingWrites = () => useSyncExternalStore(subscribe, () => inFlight);
