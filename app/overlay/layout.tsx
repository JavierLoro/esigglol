import { AutoRefresh } from '@/components/overlay/AutoRefresh'

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body { background: transparent !important; }
        body > footer { display: none !important; }
      `}</style>
      <div className="min-h-screen bg-transparent">
        <AutoRefresh />
        {children}
      </div>
    </>
  )
}
