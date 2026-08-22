import axios from 'axios'

axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''

// Ensure auth header is always present after page refresh.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers || {}
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export const api = {
  // Auth
  login:    (data)    => axios.post('/api/auth/login',    data),
  register: (data)    => axios.post('/api/auth/register', data),
  me:       ()        => axios.get('/api/auth/me'),

  // Sessions
  getSessions:  ()     => axios.get('/api/sessions/my'),
  logSession:   (data) => axios.post('/api/sessions/log', {
    raw: {
      start:    data.start,
      end:      data.end,
      duration: data.duration,
    }
  }),

  // Parent
  getChildren:   ()         => axios.get('/api/parent/children'),
  linkChild:     (identifier) => axios.post('/api/parent/link', { identifier }),
  getDashboard:  (childId)  => axios.get(`/api/parent/dashboard/${childId}`),
  getDashboardWeekly: (childId) => axios.get(`/api/parent/dashboard/${childId}/weekly`),
  updateControls:(childId, data) => axios.put(`/api/parent/controls/${childId}`, data),
}
