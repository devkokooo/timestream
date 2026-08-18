import { useCallback, useSyncExternalStore } from "react";

const tabs = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Gallery tab choice that survives stamp remounts for one exhibit. */
export function useExhibitTab<T extends string>(key: string, fallback: T): [T, (next: T) => void] {
  const read = useCallback(() => (tabs.get(key) as T | undefined) ?? fallback, [key, fallback]);
  const tab = useSyncExternalStore(subscribe, read, read);
  const setTab = useCallback((next: T) => {
    if (tabs.get(key) === next) return;
    tabs.set(key, next);
    listeners.forEach((listener) => listener());
  }, [key]);
  return [tab, setTab];
}
