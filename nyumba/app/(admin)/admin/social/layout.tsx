/**
 * Social media section layout — covers the entire viewport so the admin shell
 * sidebar is invisible behind this overlay.  This is a SERVER component so it
 * renders before any client-side JavaScript runs, which is why it's more
 * reliable than the usePathname() bypass in AdminShell.
 */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        background: '#f4f4f0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  )
}
