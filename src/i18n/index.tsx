import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sv } from './sv';

export type Lang = 'en' | 'sv';

const STORAGE_KEY = 'artemis.lang';

// English-as-key: the source strings ARE the keys. `en` is identity (returns the
// key), `sv` maps each English source string to its Swedish translation. Missing
// Swedish entries fall back to the English source, so nothing ever shows blank.
const DICTS: Record<Lang, Record<string, string>> = { en: {}, sv };

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'sv' || v === 'en') setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

export type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Translator. `tr('Send wellness check')`, or `tr('Hi {name}', { name })`. */
export function useT(): TFn {
  const { lang } = useContext(Ctx);
  return useCallback<TFn>(
    (key, params) => {
      let out = DICTS[lang][key] ?? key;
      if (params) {
        for (const k of Object.keys(params)) {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]));
        }
      }
      return out;
    },
    [lang],
  );
}
