'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface DalaliProfile {
  fullName: string
  whatsappNumber: string
  phone: string | null
  avatarUrl: string | null
  bio: string | null
}

// Module-level cache so the fetch only happens once per page load
let cachedProfile: DalaliProfile | null = null
let fetchPromise: Promise<DalaliProfile | null> | null = null

async function fetchProfile(): Promise<DalaliProfile | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const [userRes, profileRes] = await Promise.all([
    supabase.from('users').select('full_name, phone, avatar_url').eq('id', session.user.id).single(),
    supabase.from('dalali_profiles').select('whatsapp_number, bio').eq('user_id', session.user.id).maybeSingle(),
  ])

  return {
    fullName:       userRes.data?.full_name ?? '',
    whatsappNumber: profileRes.data?.whatsapp_number ?? '',
    phone:          userRes.data?.phone ?? null,
    avatarUrl:      userRes.data?.avatar_url ?? null,
    bio:            profileRes.data?.bio ?? null,
  }
}

export function useDalaliProfile() {
  const [profile, setProfile] = useState<DalaliProfile | null>(cachedProfile)
  const [loading, setLoading] = useState(!cachedProfile)

  useEffect(() => {
    if (cachedProfile) {
      setProfile(cachedProfile)
      setLoading(false)
      return
    }

    if (!fetchPromise) {
      fetchPromise = fetchProfile()
    }

    fetchPromise.then(data => {
      if (data) cachedProfile = data
      setProfile(data)
      setLoading(false)
    })
  }, [])

  function refreshProfile() {
    cachedProfile = null
    fetchPromise = null
    setLoading(true)
    fetchPromise = fetchProfile()
    fetchPromise.then(data => {
      if (data) cachedProfile = data
      setProfile(data)
      setLoading(false)
    })
  }

  return { profile, loading, refreshProfile }
}
