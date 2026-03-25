export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'transparent' }}>
      {children}
    </div>
  )
}
