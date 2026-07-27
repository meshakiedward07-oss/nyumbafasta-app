'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n/translations'

const STORAGE_KEY = 'nf_lang'

const OPTIONS: { lang: Lang; flag: string; name: string; nameLocal: string; desc: string }[] = [
  {
    lang:      'sw',
    flag:      '🇹🇿',
    name:      'Kiswahili',
    nameLocal: 'Kiswahili',
    desc:      'Lugha ya Kiswahili — Tanzania',
  },
  {
    lang:      'en',
    flag:      '🇬🇧',
    name:      'English',
    nameLocal: 'English',
    desc:      'English language — International',
  },
]

export default function LanguagePicker() {
  const { setLang } = useLanguage()
  const [show,     setShow]     = useState(false)
  const [selected, setSelected] = useState<Lang>('sw')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    // Show only if no language has been chosen before
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === null) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  function choose(l: Lang) {
    setSelected(l)
  }

  function handleContinue() {
    if (saving) return
    setSaving(true)
    setLang(selected)
    localStorage.setItem(STORAGE_KEY, selected)
    // Small delay so the ripple is visible
    setTimeout(() => setShow(false), 200)
  }

  const sel = OPTIONS.find(o => o.lang === selected) ?? OPTIONS[0]

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-end sm:justify-center overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s cubic-bezier(.22,.61,.36,1) both' }}
      >
        {/* Decorative top bar */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4">
          <div className="relative h-10 w-32 mb-5">
            <Image
              src="/transparent_logo_nyumbafasta.png"
              alt="NyumbaFasta"
              fill
              className="object-contain"
              sizes="128px"
              priority
            />
          </div>

          {/* Bilingual title */}
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight text-center leading-tight">
            Chagua Lugha
            <span className="text-gray-300 mx-2">/</span>
            Choose Language
          </h2>
          <p className="text-sm text-gray-400 mt-1.5 text-center leading-relaxed">
            {selected === 'en'
              ? 'Select your preferred language for NyumbaFasta'
              : 'Chagua lugha unayotaka kutumia kwenye NyumbaFasta'}
          </p>
        </div>

        {/* Language options */}
        <div className="px-5 pb-5 space-y-3">
          {OPTIONS.map(opt => {
            const isSelected = selected === opt.lang
            return (
              <button
                key={opt.lang}
                onClick={() => choose(opt.lang)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all duration-150 ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100'
                }`}
              >
                {/* Flag */}
                <span className="text-4xl leading-none flex-shrink-0 select-none">{opt.flag}</span>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-base leading-tight ${isSelected ? 'text-primary-700' : 'text-gray-800'}`}>
                    {opt.name}
                  </p>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'text-primary-500' : 'text-gray-400'}`}>
                    {opt.desc}
                  </p>
                </div>

                {/* Checkmark */}
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {isSelected && (
                    <i className="ti ti-check text-white text-xs" aria-hidden="true" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Continue button */}
        <div className="px-5 pb-8 sm:pb-6">
          <button
            onClick={handleContinue}
            className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base tracking-wide hover:bg-primary-600 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(29,158,117,0.3)]"
          >
            {selected === 'en' ? 'Continue' : 'Endelea'}
            <span className="ml-2 text-primary-200 font-normal text-sm">
              — {sel.flag} {sel.name}
            </span>
          </button>
        </div>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
