import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';

const service = axios.create({ baseURL: '/api/v1', timeout: 15000 });

let refreshing = null;

function getToken() { return localStorage.getItem('accessToken') || ''; }
function getRefresh() { return localStorage.getItem('refreshToken') || ''; }
function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function doRefresh() {
  const rt = getRefresh();
  if (!rt) return false;
  try {
    const resp = await axios.post('/api/v1/auth/refresh', { refreshToken: rt });
    const d = resp.data?.data;
    if (d && d.accessToken) {
      localStorage.setItem('accessToken', d.accessToken);
      if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

service.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

service.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && body.code === 0) return body.data;
    ElMessage.error(body?.message || '请求失败');
    return Promise.reject(new Error(body?.message || '请求失败'));
  },
  async (error) => {
    const status = error.response?.status;
    const body = error.response?.data || {};
    const config = error.config;

    // 令牌过期：单飞刷新后重放一次
    if (status === 401 && body.code === 'TOKEN_EXPIRED' && !config._retried) {
      config._retried = true;
      if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
      const ok = await refreshing;
      if (ok) return service(config);
      clearAuth();
      router.push('/login');
      return Promise.reject(error);
    }
    if (status === 401) {
      clearAuth();
      if (router.currentRoute.value.path !== '/login') router.push('/login');
    }

    ElMessage.error(body.message || (status >= 500 ? '服务器异常，请稍后再试' : '请求失败'));
    return Promise.reject(error);
  }
);

export default service;
