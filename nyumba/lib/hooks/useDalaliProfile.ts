'use client'

import { useEffect, useState } from 'react'

export interface DalaliProfile {
  fullName: string
  whatsappNumber: string
  phone: string | null
  avatarUrl: string | null
  bio: string | null
  // 'approved' is set by admin verification endpoint; treat same as 'verified'
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'approved' | 'rejected'
}

export function useDalaliProfile() {
  const [profile, setProfile] = useState<DalaliProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/dalali/profile')
      .then(r => r.ok ? r.json() : null)
      .then((data: DalaliProfile | null) => {
        if (!cancelled) { setProfile(data); setLoading(false) }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function refreshProfile() {
    setLoading(true)
    fetch('/api/v1/dalali/profile')
      .then(r => r.ok ? r.json() : null)
      .then((data: DalaliProfile | null) => { setProfile(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  return { profile, loading, refreshProfile }
}
