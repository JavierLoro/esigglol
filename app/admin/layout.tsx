'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Trophy, Calendar, LogOut } from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/equipos', label: 'Equipos', icon: Users },
  { href: '/admin/fases', label: 'Fases', icon: Trophy },
  { href: '/admin/partidos', label: 'Partidos', icon: Calendar },
]

function NavLink({ href, label, icon: Icon, exact = false }: { href: string; label: string; icon: React.ElementType; exact?: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
        active ? 'text-white bg-[#0097D7]/15 font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  )
}

function MobileNavLink({ href, label, icon: Icon, exact = false }: { href: string; label: string; icon: React.ElementType; exact?: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={clsx(
        'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs transition-colors flex-1',
        active ? 'text-[#0097D7]' : 'text-white/40 hover:text-white'
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  )
}

async function handleLogout() {
  await fetch('/api/admin/login', { method: 'DELETE' })
  window.location.href = '/admin/login'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar — solo desktop */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-white/10 bg-[#0d1321] flex-col">
        <div className="px-4 py-5 border-b border-white/10">
          <span className="text-sm font-bold text-[#0097D7]">Panel Admin</span>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-1">
          {navItems.map(({ href, label, icon }) => (
            <NavLink key={href} href={href} label={label} icon={icon} exact={href === '/admin'} />
          ))}
        </nav>
        <div className="p-2 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/30 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">
        {children}
      </div>

      {/* Bottom nav — solo móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d1321]/95 backdrop-blur border-t border-white/10 flex items-center px-2 py-1 z-50">
        {navItems.map(({ href, label, icon }) => (
          <MobileNavLink key={href} href={href} label={label} icon={icon} exact={href === '/admin'} />
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white transition-colors flex-1"
        >
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </nav>
    </div>
  )
}
