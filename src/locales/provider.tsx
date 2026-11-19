import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { zh } from './zh';

type Language = 'en' | 'zh';
const key = 'microhub.language';
const Context = createContext({
  language: 'en' as Language,
  setLanguage: (_value: Language) => {},
  t: (text: string) => text,
});
export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, set] = useState<Language>('en');
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const value =
          Platform.OS === 'web'
            ? window.localStorage.getItem(key)
            : await SecureStore.getItemAsync(key);
        if (active && !changed.current && (value === 'en' || value === 'zh'))
          set(value);
      } catch {
        // Keep the default language when preference storage is unavailable.
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined')
      document.documentElement.lang = language === 'zh' ? 'zh-Hans' : 'en';
  }, [language]);
  function setLanguage(value: Language) {
    changed.current = true;
    set(value);
    writes.current = writes.current.then(async () => {
      try {
        if (Platform.OS === 'web') window.localStorage.setItem(key, value);
        else await SecureStore.setItemAsync(key, value);
      } catch {
        // The selected language still applies to this session.
      }
    });
  }
  const t = (text: string) =>
    language === 'zh' && Object.hasOwn(zh, text.trim())
      ? text.replace(text.trim(), zh[text.trim()]!)
      : text;
  return (
    <Context.Provider value={{ language, setLanguage, t }}>
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
