import { useCallback, useEffect, useRef, useState } from 'react';
/** Synchronous lock closes the gap before React commits disabled button state. */
export function useBusy() {
  const locked = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const start = useCallback(() => {
    if (locked.current || !mounted.current) return false;
    locked.current = true;
    setBusy(true);
    return true;
  }, []);
  const finish = useCallback(() => {
    locked.current = false;
    if (mounted.current) setBusy(false);
  }, []);
  return { busy, start, finish };
}
