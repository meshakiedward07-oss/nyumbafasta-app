'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  listingId: string
  className?: string
  size?: 'sm' | 'md'
}

export default function SaveButton({ listingId, className = '', size = 'md' }: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(false)

  // Check saved state on mount
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from('saved_listings')
        .select('id')
        .eq('client_id', user.id)
        .eq('listing_id', listingId)
        .maybeSingle()
      if (!cancelled) setSaved(!!data)
    }
    check()
    return () => { cancelled = true }
  }, [listingId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login?redirect=/'); return }

    // Optimistic update
    const next = !saved
    setSaved(next)
    setLoading(true)

    try {
      if (next) {
        const { error } = await supabase
          .from('saved_listings')
          .insert({ client_id: user.id, listing_id: listingId })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('saved_listings')
          .delete()
          .eq('client_id', user.id)
          .eq('listing_id', listingId)
        if (error) throw error
      }
    } catch {
      setSaved(!next) // revert on error
    } finally {
      setLoading(false)
    }
  }

  const sz = size === 'sm'
    ? 'w-11 h-11 text-base'
    : 'w-11 h-11 text-xl'

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? 'Ondoa kwenye saved' : 'Hifadhi listing'}
      className={`
        ${sz} rounded-full flex items-center justify-center
        transition-all duration-150 active:scale-90
        ${saved
          ? 'bg-red-50 text-red-500'
          : 'bg-white/90 text-gray-400 hover:text-red-400'}
        shadow-sm backdrop-blur-sm
        ${loading ? 'opacity-60' : ''}
        ${className}
      `}
    >
      {loading
        ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin block" />
        : saved ? <i className="ti ti-heart-filled text-red-500" aria-hidden="true" /> : <i className="ti ti-heart" aria-hidden="true" />
      }
    </button>
  )
}
