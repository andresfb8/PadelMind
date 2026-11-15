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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useWriteErrors = () => useSyncExternalStore(subscribe, () => errors);
