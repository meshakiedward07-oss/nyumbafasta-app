'use client'
import { useLanguage } from '@/lib/i18n/context'

type Size = 'sm' | 'md'

export default function LangToggle({ size = 'md' }: { size?: Size }) {
  const { lang, setLang } = useLanguage()

  const base = size === 'sm'
    ? 'flex-1 py-1 text-xs font-semibold transition-colors'
    : 'flex-1 py-1.5 text-xs font-semibold transition-colors'

  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
      {(['sw', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`${base} ${
            lang === l
              ? 'bg-primary-500 text-white'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {l === 'sw' ? '🇹🇿 SW' : '🇬🇧 EN'}
        </button>
      ))}
    </div>
  )
}
