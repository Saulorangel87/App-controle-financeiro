import axios from "axios";

// URL do backend. Em dev aponta pro localhost; em produção, troque via
// variável de ambiente VITE_API_URL (ex: https://despesas-api.devsaulo.com.br/api)
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

let accessToken = null;

export function definirToken(token) {
  accessToken = token;
}

export async function renovarSessao() {
  const res = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
  accessToken = res.data.token;
  return res.data;
}

const api = axios.create({ baseURL, withCredentials: true });

// Anexa o access token curto mantido apenas em memória em toda requisição.
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Se o access token expirar, tenta uma rotação silenciosa pelo cookie HttpOnly.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config;
    const rotaAuth = config?.url?.includes('/auth/');
    if (error.response?.status === 401 && !config?._tentouRenovar && !rotaAuth) {
      config._tentouRenovar = true;
      return renovarSessao()
        .then(() => api(config))
        .catch(() => {
          accessToken = null;
          window.sessionStorage.removeItem("usuario");
          if (window.location.pathname !== "/login") window.location.href = "/login";
          return Promise.reject(error);
        });
    }
    return Promise.reject(error);
  },
);

export default api;
