import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import Layout    from '@/components/Layout'
import Login     from '@/pages/Login'
import Terminals from '@/pages/Terminals'
import Ports     from '@/pages/Ports'
import Logs      from '@/pages/Logs'
import Settings  from '@/pages/Settings'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth()
  if (!ready) return (
    <div className="h-full flex items-center justify-center text-muted text-sm">
      Loading…
    </div>
  )
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const init = useAuth(s => s.init)
  useEffect(() => { init() }, [init])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<Navigate to="/terminals" replace />} />
          <Route path="terminals" element={<Terminals />} />
          <Route path="ports"     element={<Ports />} />
          <Route path="logs"      element={<Logs />} />
          <Route path="settings"  element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
