import Navbar from '@/components/Navbar'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/5 px-4 py-6 text-center text-xs text-white/30 leading-relaxed">
        ESIgg.lol isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
      </footer>
    </>
  )
}
