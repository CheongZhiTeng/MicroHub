import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/validation';

type SessionState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
  recovery: boolean;
  setRecovery: (value: boolean) => void;
  retry: () => void;
};
const Context = createContext<SessionState | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);
  const version = useRef(0);
  const retry = useCallback(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const current = ++version.current;
    setLoading(true);
    setError(null);
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (current !== version.current) return;
        if (error) throw error;
        setSession(data.session);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (current === version.current) {
          setError(errorMessage(error));
          setLoading(false);
        }
      });
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      version.current++;
      setSession(next);
      setLoading(false);
      setError(null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    // Hydration deliberately enters loading state until secure storage resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    retry();
    if (Platform.OS !== 'web') supabase.auth.startAutoRefresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    const counter = version;
    return () => {
      counter.current++;
      subscription.unsubscribe();
      listener.remove();
      supabase?.auth.stopAutoRefresh();
    };
  }, [retry]);
  return (
    <Context.Provider
      value={{ session, loading, error, recovery, setRecovery, retry }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider required');
  return value;
}
