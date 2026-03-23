import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export const useWebSocket = () => {
  const { token } = useAuth()
  const ws        = useRef(null)
  const [alerts,      setAlerts]      = useState([])
  const [connected,   setConnected]   = useState(false)
  const [sessionUpdate, setSessionUpdate] = useState(null)

  const connect = useCallback(() => {
    if (!token || ws.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws.current = new WebSocket(`${protocol}://${window.location.host}/ws`)

    ws.current.onopen = () => {
      setConnected(true)
      ws.current.send(JSON.stringify({ type: 'REGISTER', token }))
    }

    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'SESSION_UPDATE') {
          setSessionUpdate(msg)
          return
        }
        if (['ADDICTION_ALERT','PLAYTIME_LIMIT_EXCEEDED','NIGHT_GAMING_ALERT'].includes(msg.type)) {
          setAlerts(prev => [{ ...msg, id: Date.now() }, ...prev].slice(0, 20))
        }
      } catch {}
    }

    ws.current.onclose = () => {
      setConnected(false)
      // Reconnect after 3s
      setTimeout(connect, 3000)
    }

    ws.current.onerror = () => ws.current?.close()
  }, [token])

  useEffect(() => {
    connect()
    return () => ws.current?.close()
  }, [connect])

  const dismissAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id))

  return { alerts, connected, sessionUpdate, dismissAlert }
}
