import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Torneo LoL',
  description: 'Web oficial del torneo privado de League of Legends',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#0a0e1a] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
