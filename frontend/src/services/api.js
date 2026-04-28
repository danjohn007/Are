import axios from 'axios';

const defaultApiBase = '/backare/api';
let refreshPromise = null;

function clearAuthStorage() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentUser');
  window.dispatchEvent(new Event('auth:logout'));
}

function redirectToLogin() {
  if (window.location.pathname !== '/are/login') {
    window.location.assign('/are/login');
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${defaultApiBase}/auth/refresh`, { refreshToken })
      .then((response) => {
        const nextToken = response?.data?.data?.accessToken;
        if (!nextToken) {
          throw new Error('Refresh token response missing access token');
        }
        localStorage.setItem('accessToken', nextToken);
        return nextToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function looksLikeHtmlResponse(response) {
  const contentType = String(response?.headers?.['content-type'] || '').toLowerCase();
  const body = response?.data;
  if (contentType.includes('text/html')) {
    return true;
  }
  if (typeof body === 'string' && /^\s*<!doctype html/i.test(body)) {
    return true;
  }
  return false;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiBase
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  console.log('[API REQUEST]', {
    method: config.method,
    url: `${config.baseURL}${config.url}`,
    data: config.data || null
  });

  return config;
});

api.interceptors.response.use(
  async (response) => {
    // Si el reverse proxy reescribe a index.html, reintentamos una vez con /backare/api.
    if (looksLikeHtmlResponse(response)) {
      const alreadyRetried = Boolean(response?.config?._baseFixRetried);
      const currentBase = String(response?.config?.baseURL || '');

      if (!alreadyRetried && currentBase !== '/backare/api') {
        const retryConfig = {
          ...response.config,
          baseURL: '/backare/api',
          _baseFixRetried: true,
        };
        return api.request(retryConfig);
      }

      throw new Error('API devolvio HTML en lugar de JSON. Revisa VITE_API_URL o reglas de rewrite en cPanel.');
    }

    console.log('[API RESPONSE]', {
      url: `${response.config.baseURL}${response.config.url}`,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;

    if (status === 401 && !originalRequest._retry && !String(originalRequest.url || '').includes('/auth/')) {
      originalRequest._retry = true;

      return refreshAccessToken()
        .then((nextToken) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${nextToken}`;
          return api.request(originalRequest);
        })
        .catch((refreshError) => {
          clearAuthStorage();
          redirectToLogin();
          return Promise.reject(refreshError);
        });
    }

    console.error('[API ERROR]', {
      url: `${error?.config?.baseURL || ''}${error?.config?.url || ''}`,
      status,
      data: error?.response?.data,
      message: error?.message
    });
    return Promise.reject(error);
  }
);

export async function getAllPaginated(endpoint, params = {}, pageSize = 100) {
  const collected = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await api.get(endpoint, {
      params: {
        ...params,
        page,
        limit: pageSize
      }
    });

    const payload = response.data || {};
    const data = Array.isArray(payload.data) ? payload.data : [];
    const meta = payload.meta || {};

    collected.push(...data);
    totalPages = Math.max(Number(meta.totalPages || 1), 1);
    page += 1;
  } while (page <= totalPages);

  return collected;
}

export default api;
