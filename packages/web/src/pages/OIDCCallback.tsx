import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

export default function OIDCCallback() {
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const params      = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')

    if (!accessToken) {
      navigate('/login?error=missing_token', { replace: true })
      return
    }

    // Store the token (refresh cookie was set by the server before this redirect)
    loginWithToken(accessToken)

    // Clean up the token from the URL, then navigate
    window.history.replaceState({}, '', window.location.pathname)
    navigate('/terminals', { replace: true })
  }, [loginWithToken, navigate])

  return (
    <div className="h-full flex items-center justify-center bg-surface">
      <div className="flex items-center gap-3 text-muted text-sm">
        <Loader2 size={18} className="animate-spin text-accent" />
        Completing sign in…
      </div>
    </div>
  )
}
