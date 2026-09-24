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

  // Interview Endpoints
  interviews: {
    list: () => API.request('/interviews', { method: 'GET' }),
    get: (id) => API.request(`/interviews/${id}`, { method: 'GET' }),
    create: (data) => API.request('/interviews', { method: 'POST', body: data }),
    start: (id) => API.request(`/interviews/${id}/start`, { method: 'POST' }),
    end: (id) => API.request(`/interviews/${id}/end`, { method: 'POST' })
  },

  // Question Bank Endpoints
  questions: {
    list: () => API.request('/questions', { method: 'GET' }),
    get: (id) => API.request(`/questions/${id}`, { method: 'GET' }),
    create: (data) => API.request('/questions', { method: 'POST', body: data })
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
