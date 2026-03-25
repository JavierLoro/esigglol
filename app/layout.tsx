import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Torneo LoL',
  description: 'Web oficial del torneo privado de League of Legends',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#0a0e1a] text-white antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/5 px-4 py-6 text-center text-xs text-white/30 leading-relaxed">
          ESIgg.lol isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
        </footer>
      </body>
    </html>
  )
}
