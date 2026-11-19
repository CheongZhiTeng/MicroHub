import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { theme, darkTheme } from './tokens';
export type ThemeMode = 'system' | 'light' | 'dark';
const key = 'microhub.appearance';
const Context = createContext({
  theme,
  mode: 'system' as ThemeMode,
  dark: false,
  setMode: (_mode: ThemeMode) => {},
});
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [mode, update] = useState<ThemeMode>('system');
  const changed = useRef(false);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const value =
          Platform.OS === 'web'
            ? window.localStorage.getItem(key)
            : await SecureStore.getItemAsync(key);
        if (
          active &&
          !changed.current &&
          ['light', 'dark', 'system'].includes(value ?? '')
        )
          update(value as ThemeMode);
      } catch {
        /* Preference storage is optional. */
      }
    };
    void read();
    return () => {
      active = false;
    };
  }, []);
  const setMode = (value: ThemeMode) => {
    changed.current = true;
    update(value);
    queue.current = queue.current.then(async () => {
      try {
        if (Platform.OS === 'web') window.localStorage.setItem(key, value);
        else await SecureStore.setItemAsync(key, value);
      } catch {
        /* Keep the current session preference. */
      }
    });
  };
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return (
    <Context.Provider
      value={{ theme: dark ? darkTheme : theme, mode, dark, setMode }}
    >
      {children}
    </Context.Provider>
  );
}
export const useTheme = () => useContext(Context);
