import { AutoRefresh } from '@/components/overlay/AutoRefresh'

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <AutoRefresh />
      {children}
    </div>
  )
}
