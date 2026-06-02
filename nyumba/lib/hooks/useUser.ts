'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type UserRole = 'client' | 'dalali' | 'admin' | null

type UseUserResult = {
  user: User | null
  role: UserRole
  loading: boolean
}

export function useUser(): UseUserResult {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!mounted) return

      if (user) {
        setUser(user)
        // Pata role kutoka users table
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        if (mounted) setRole(data?.role ?? 'client')
      } else {
        setUser(null)
        setRole(null)
      }
      if (mounted) setLoading(false)
    }

    loadUser()

    // Sikiliza mabadiliko ya auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (session?.user) {
          setUser(session.user)
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()
          if (mounted) setRole(data?.role ?? 'client')
        } else {
          setUser(null)
          setRole(null)
        }
        if (mounted) setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  return { user, role, loading }
}
