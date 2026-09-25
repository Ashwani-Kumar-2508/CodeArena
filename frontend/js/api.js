/**
 * Centralized API client for CodeArena
 */
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      throw error;
    }
  },

  // Auth Endpoints
  auth: {
    register: (userData) => API.request('/auth/register', { method: 'POST', body: userData }),
    login: (credentials) => API.request('/auth/login', { method: 'POST', body: credentials }),
    logout: () => API.request('/auth/logout', { method: 'POST' }),
    me: () => API.request('/auth/me', { method: 'GET' })
  },

  // Admin Endpoints
  admin: {
    getStats: () => API.request('/admin/stats', { method: 'GET' }),
    getUsers: () => API.request('/admin/users', { method: 'GET' }),
    getInterviews: () => API.request('/admin/interviews', { method: 'GET' }),
    getActivity: () => API.request('/admin/activity', { method: 'GET' })
  },

  // Interview Endpoints
  interviews: {
    list: () => API.request('/interviews', { method: 'GET' }),
    get: (id) => API.request(`/interviews/${id}`, { method: 'GET' }),
    create: (data) => API.request('/interviews', { method: 'POST', body: data }),
    start: (id) => API.request(`/interviews/${id}/start`, { method: 'POST' }),
    end: (id) => API.request(`/interviews/${id}/end`, { method: 'POST' }),
    cancel: (id) => API.request(`/interviews/${id}/cancel`, { method: 'POST' }),
    getCandidates: () => API.request('/interviews/candidates', { method: 'GET' })
  },

  // Question Bank Endpoints
  questions: {
    list: (params = {}) => {
      const cleanParams = {};
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '' && params[k] !== 'ALL') {
          cleanParams[k] = params[k];
        }
      });
      const qs = new URLSearchParams(cleanParams).toString();
      return API.request('/questions' + (qs ? '?' + qs : ''), { method: 'GET' });
    },
    get: (id) => API.request(`/questions/${id}`, { method: 'GET' }),
    create: (data) => API.request('/questions', { method: 'POST', body: data }),
    update: (id, data) => API.request(`/questions/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => API.request(`/questions/${id}`, { method: 'DELETE' })
  },

  // Candidate Practice Endpoints (Decoupled from live interviews)
  practice: {
    getDashboard: () => API.request('/practice', { method: 'GET' }),
    add: (questionId) => API.request(`/practice/${questionId}`, { method: 'POST' }),
    remove: (questionId) => API.request(`/practice/${questionId}`, { method: 'DELETE' }),
    run: (questionId, payload) => API.request(`/practice/${questionId}/run`, { method: 'POST', body: payload }),
    submit: (questionId, payload) => API.request(`/practice/${questionId}/submit`, { method: 'POST', body: payload })
  },

  // Code Execution Endpoints
  code: {
    run: (payload) => API.request('/code/run', { method: 'POST', body: payload }),
    submit: (payload) => API.request('/code/submit', { method: 'POST', body: payload })
  },

  // Evaluation Endpoints
  evaluations: {
    create: (data) => API.request('/evaluations', { method: 'POST', body: data }),
    get: (interviewId) => API.request(`/evaluations/${interviewId}`, { method: 'GET' })
  },

  // Replay Endpoints
  replay: {
    get: (interviewId) => API.request(`/replay/${interviewId}`, { method: 'GET' })
  }
};

window.API = API;
