import { AutoRefresh } from '@/components/overlay/AutoRefresh'
import './overlay.css'

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { background: transparent !important; }
        body > footer { display: none !important; }
        nextjs-portal { display: none; }
      `}</style>
      <div className="min-h-screen bg-transparent">
        <AutoRefresh />
        {children}
      </div>
    </>
  )
}
