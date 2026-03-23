import axios from 'axios'

export const api = {
  // Auth
  login:    (data)    => axios.post('/api/auth/login',    data),
  register: (data)    => axios.post('/api/auth/register', data),
  me:       ()        => axios.get('/api/auth/me'),

  // Sessions
  getSessions: ()     => axios.get('/api/sessions/my'),

  // Parent
  getChildren:   ()         => axios.get('/api/parent/children'),
  linkChild:     (childId)  => axios.post('/api/parent/link', { childId }),
  getDashboard:  (childId)  => axios.get(`/api/parent/dashboard/${childId}`),
  updateControls:(childId, data) => axios.put(`/api/parent/controls/${childId}`, data),
}
