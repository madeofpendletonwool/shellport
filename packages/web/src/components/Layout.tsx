import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Terminal, Globe, FileText, Settings, LogOut } from 'lucide-react'
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
  const [logoError, setLogoError] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full bg-surface">
      {/* Sidebar */}
      <aside className="flex flex-col w-14 md:w-56 bg-surface2 border-r border-border flex-shrink-0">

        {/* Logo — drop logo.svg into packages/web/public/logo.svg */}
        <div className="flex items-center gap-2.5 px-3 md:px-4 py-4 border-b border-border flex-shrink-0 min-h-[56px]">
          {/* Mobile: icon mark */}
          <div className="md:hidden w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Terminal size={14} className="text-accent" />
          </div>
          {/* Desktop: sidebar logo → falls back to wordmark */}
          <div className="hidden md:flex items-center gap-2 min-w-0">
            {!logoError ? (
              <img
                src="/logo-sidebar.png"
                alt="Shellport"
                className="w-44 h-auto max-h-12 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-sm font-bold text-white tracking-tight lowercase select-none">
                shellport
              </span>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-panel text-sm transition-all duration-180 ${
                  isActive
                    ? 'bg-accent/[0.12] text-accent'
                    : 'text-muted hover:text-white hover:bg-hover'
                }`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="hidden md:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-6 h-6 rounded-full flex-shrink-0 ring-1 ring-border"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent text-xs font-bold">
                  {user?.username?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div className="hidden md:flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium text-white/90 truncate">{user?.username}</span>
              {user?.email && (
                <span className="text-[11px] text-muted truncate">{user.email}</span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-muted hover:text-danger transition-colors duration-180 rounded-md hover:bg-danger/10 flex-shrink-0"
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
