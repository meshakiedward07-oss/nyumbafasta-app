'use client'
import { useEffect } from 'react'

// Catches errors thrown inside the root app/layout.tsx itself.
// Must render its own <html> and <body> — Next.js App Router requirement.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="sw">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f4f4f0' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '24px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', border: '1px solid #fecaca',
            padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111' }}>
              Programu imekutana na tatizo
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#666' }}>
              {error.message || 'Hitilafu imetokea. Tafadhali pakia upya ukurasa.'}
            </p>
            {error.digest && (
              <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#999', fontFamily: 'monospace' }}>
                ID: {error.digest}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  padding: '10px 24px', background: '#1D9E75', color: '#fff',
                  border: 'none', borderRadius: '12px', fontWeight: 600,
                  fontSize: '14px', cursor: 'pointer',
                }}
              >
                Jaribu tena
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error renders its own <html> outside the router context; <Link> is unavailable */}
              <a
                href="/"
                style={{
                  padding: '10px 24px', background: '#f0f0f0', color: '#333',
                  borderRadius: '12px', fontWeight: 600, fontSize: '14px',
                  textDecoration: 'none', display: 'inline-block',
                }}
              >
                Rudi Nyumbani
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
