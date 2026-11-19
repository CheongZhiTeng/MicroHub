import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSession } from '../session';
export type Edit = {
  base: number;
  revision: number;
  body: string;
  link: string;
};
// Preserve unacknowledged typing through navigation or a transient network
// failure. Only the signed-in account's in-memory copy survives a screen remount.
const Unsaved = createContext<Map<string, Edit> | null>(null);
export function HomeworkDraftProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const owner = session?.user.id;
  const cache = useMemo(
    () => ({ owner, edits: new Map<string, Edit>() }),
    [owner],
  );
  return <Unsaved.Provider value={cache.edits}>{children}</Unsaved.Provider>;
}
export function useUnsavedEdit(id: string) {
  const cache = useContext(Unsaved);
  const [edit, setEdit] = useState<Edit | null>(() => cache?.get(id) ?? null);
  function update(value: Edit | null | ((old: Edit | null) => Edit | null)) {
    const next =
      typeof value === 'function' ? value(cache?.get(id) ?? null) : value;
    if (next) cache?.set(id, next);
    else cache?.delete(id);
    setEdit(next);
  }
  return [edit, update] as const;
}
