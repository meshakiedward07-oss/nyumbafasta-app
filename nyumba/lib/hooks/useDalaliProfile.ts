'use client'

import { useEffect, useState } from 'react'

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
  const res = await fetch('/api/v1/dalali/profile')
  if (!res.ok) return null
  return res.json()
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
