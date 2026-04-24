import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/backare/api'
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
  (response) => {
    console.log('[API RESPONSE]', {
      url: `${response.config.baseURL}${response.config.url}`,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('[API ERROR]', {
      url: `${error?.config?.baseURL || ''}${error?.config?.url || ''}`,
      status: error?.response?.status,
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
