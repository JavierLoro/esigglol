'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { clsx } from 'clsx'
import { Swords, Menu, X } from 'lucide-react'

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/fases', label: 'Fases' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/comparar', label: 'Comparar' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (pathname.startsWith('/overlay')) return null

  return (
    <header className="bg-[#0d1321]/95 backdrop-blur sticky top-0 z-50 border-b border-white/8">
      <div className="h-0.5 bg-gradient-to-r from-[#0097D7] via-[#33b3e8] to-[#B30133]" />
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-base text-white shrink-0" onClick={() => setOpen(false)}>
          <div className="w-7 h-7 rounded bg-[#0097D7] flex items-center justify-center">
            <Swords size={15} className="text-white" />
          </div>
          <span>ESI<span className="text-[#0097D7]">gg</span>.lol</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex h-14">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'px-4 h-14 flex items-center text-sm font-medium transition-colors border-b-2',
                pathname === href
                  ? 'text-white border-[#0097D7]'
                  : 'text-white/50 border-transparent hover:text-white hover:border-white/20'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/admin" className="hidden sm:block text-xs text-white/25 hover:text-white/50 transition-colors">
            Admin
          </Link>
          {/* Hamburger */}
          <button
            onClick={() => setOpen(o => !o)}
            className="sm:hidden p-2 text-white/50 hover:text-white transition-colors"
            aria-label="Menú"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden bg-[#0d1321] border-t border-white/8">
          <nav className="flex flex-col py-2">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={clsx(
                  'px-5 py-3 text-sm font-medium transition-colors border-l-2',
                  pathname === href
                    ? 'text-white border-[#0097D7] bg-[#0097D7]/5'
                    : 'text-white/50 border-transparent hover:text-white hover:bg-white/3'
                )}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="px-5 py-3 text-xs text-white/25 hover:text-white/50 transition-colors border-l-2 border-transparent"
            >
              Admin
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
