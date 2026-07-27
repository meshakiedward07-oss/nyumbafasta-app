'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import T, { type Lang, type TKey } from './translations'

// ─── Context shape ────────────────────────────────────────────────────────────

interface LanguageContextValue {
  lang:    Lang
  setLang: (l: Lang) => void
  t:       (key: TKey) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang:    'sw',
  setLang: () => {},
  t:       (key) => T[key].sw,
})

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'nf_lang'
const COOKIE_KEY  = 'nf_lang'

function readStoredLang(): Lang | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'en' || v === 'sw' ? v : null
}

function persistLang(l: Lang) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, l)
  // Also write a cookie so server-side code can read it if needed
  document.cookie = `${COOKIE_KEY}=${l};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
  // Update <html lang> attribute
  document.documentElement.lang = l === 'en' ? 'en' : 'sw'
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to 'sw'; corrected from localStorage on mount (avoids SSR mismatch)
  const [lang, setLangState] = useState<Lang>('sw')

  useEffect(() => {
    const stored = readStoredLang()
    if (stored) {
      setLangState(stored)
      document.documentElement.lang = stored === 'en' ? 'en' : 'sw'
    }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    persistLang(l)
  }

  function t(key: TKey): string {
    return T[key][lang] ?? T[key].sw
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLanguage() {
  return useContext(LanguageContext)
}

// ─── Utility: has the user already chosen a language? ────────────────────────

export function hasChosenLanguage(): boolean {
  if (typeof window === 'undefined') return true // SSR: assume yes to avoid flicker
  return localStorage.getItem(STORAGE_KEY) !== null
}
