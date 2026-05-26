import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Terminal, Globe, FileText, Settings, LogOut, Cpu } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import Terminals from '@/pages/Terminals'

const nav = [
  { to: '/terminals', icon: Terminal, label: 'Terminals' },
  { to: '/ports',     icon: Globe,    label: 'Ports' },
  { to: '/logs',      icon: FileText, label: 'Logs' },
  { to: '/settings',  icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const onTerminals = location.pathname === '/terminals' || location.pathname === '/'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full bg-surface">
      {/* Sidebar */}
      <aside className="flex flex-col w-14 md:w-52 bg-surface2 border-r border-border flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-border">
          <Cpu size={18} className="text-accent flex-shrink-0" />
          <span className="hidden md:block text-sm font-semibold text-white tracking-wide truncate">
            Shellport
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 space-y-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-muted hover:text-white hover:bg-surface3'
                }`
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="hidden md:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-6 h-6 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0">
              <span className="text-accent text-xs font-bold">
                {user?.username?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <span className="hidden md:block text-xs text-muted truncate flex-1">
              {user?.username}
            </span>
            <button
              onClick={handleLogout}
              className="p-1 text-muted hover:text-red-400 transition-colors"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        {/* Terminals stays mounted always so sessions + WS survive navigation */}
        <div className="absolute inset-0 flex flex-col" style={{ display: onTerminals ? 'flex' : 'none' }}>
          <Terminals />
        </div>
        {!onTerminals && <Outlet />}
      </main>
    </div>
  )
}
