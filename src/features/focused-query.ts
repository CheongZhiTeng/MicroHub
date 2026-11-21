import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { errorMessage } from '../lib/validation';

export function useFocusedQuery<T>(load: () => Promise<T>) {
  const newest = useRef(0);
  const [result, setResult] = useState<{
    load: typeof load;
    data?: T;
    error?: string;
  }>();
  const refresh = useCallback(async () => {
    const request = ++newest.current;
    try {
      const data = await load();
      if (request === newest.current) setResult({ load, data });
    } catch (error) {
      if (request === newest.current)
        setResult({ load, error: errorMessage(error) });
    }
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        newest.current++;
        sub.remove();
      };
    }, [refresh]),
  );
  return {
    data: result?.load === load ? result.data : undefined,
    error: result?.load === load ? result.error : undefined,
    refresh,
  };
}
