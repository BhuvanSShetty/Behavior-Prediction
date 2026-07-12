import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  // Set axios default header whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
      queryClient.setQueryData(['me'], null)
    }
  }, [token, queryClient])

  // Fetch user profile
  const { data: userResponse, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: !!token,
    retry: false,
  })

  // Handle logout if token is invalid
  useEffect(() => {
    if (isError) {
      logout()
    }
  }, [isError])

  const user = userResponse?.data || null
  const loading = token ? isLoading : false

  const loginMutation = useMutation({
    mutationFn: (data) => api.login(data),
    onSuccess: ({ data }) => {
      localStorage.setItem('token', data.token)
      setToken(data.token)
      queryClient.setQueryData(['me'], { data: data.user })
    }
  })

  const registerMutation = useMutation({
    mutationFn: (form) => api.register(form),
    onSuccess: ({ data }) => {
      localStorage.setItem('token', data.token)
      setToken(data.token)
      queryClient.setQueryData(['me'], { data: data.user })
    }
  })

  const login = async (email, password) => {
    const res = await loginMutation.mutateAsync({ email, password })
    return res.data.user
  }

  const register = async (form) => {
    const res = await registerMutation.mutateAsync(form)
    return res.data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
