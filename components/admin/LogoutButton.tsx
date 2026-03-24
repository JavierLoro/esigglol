'use client'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    window.location.href = '/admin/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/30 hover:text-white hover:bg-white/5 transition-colors"
    >
      <LogOut size={16} />
      Cerrar sesión
    </button>
  )
}
