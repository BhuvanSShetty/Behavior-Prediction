import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export const useWebSocket = (enabled = true) => {
  const { token } = useAuth()
  const ws        = useRef(null)
  const reconnectTimer = useRef(null)
  const shouldReconnect = useRef(false)
  const reconnectAttempts = useRef(0)
  const [alerts,      setAlerts]      = useState([])
  const [connected,   setConnected]   = useState(false)
  const [sessionUpdate, setSessionUpdate] = useState(null)

  const clearReconnectTimer = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }

  const scheduleReconnect = (connectFn) => {
    if (!enabled || !shouldReconnect.current || reconnectTimer.current) return
    const delay = Math.min(3000 * Math.max(reconnectAttempts.current, 1), 15000)
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null
      connectFn()
    }, delay)
  }

  const connect = useCallback(() => {
    if (!enabled) return
    if (!token) return

    const state = ws.current?.readyState
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws.current = new WebSocket(`${protocol}://${window.location.host}/ws`)

    ws.current.onopen = () => {
      setConnected(true)
      reconnectAttempts.current = 0
      clearReconnectTimer()
      ws.current.send(JSON.stringify({ type: 'REGISTER', token }))
    }

    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'ERROR') {
          // Stop reconnect loops for auth/protocol failures until page reload/login refresh.
          shouldReconnect.current = false
          clearReconnectTimer()
          ws.current?.close(1000, 'ws-error')
          return
        }
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
      ws.current = null
      // Reconnect after 3s
      if (enabled && shouldReconnect.current) {
        reconnectAttempts.current += 1
        scheduleReconnect(connect)
      }
    }

    ws.current.onerror = () => ws.current?.close()
  }, [token, enabled])

  useEffect(() => {
    if (!enabled) {
      shouldReconnect.current = false
      reconnectAttempts.current = 0
      clearReconnectTimer()
      ws.current?.close()
      ws.current = null
      setConnected(false)
      return
    }

    shouldReconnect.current = true
    reconnectAttempts.current = 0
    connect()
    return () => {
      shouldReconnect.current = false
      reconnectAttempts.current = 0
      clearReconnectTimer()
      ws.current?.close()
    }
  }, [connect, enabled])

  const dismissAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id))

  return { alerts, connected, sessionUpdate, dismissAlert }
}
