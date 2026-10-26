import axios from "axios";

// URL do backend. Em dev aponta pro localhost; em produção, troque via
// variável de ambiente VITE_API_URL (ex: https://despesas-api.devsaulo.com.br/api)
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

let accessToken = null;

export function definirToken(token) {
  accessToken = token;
}

let renovacaoEmAndamento = null;

// Quando o access token expira, várias requisições falham com 401 ao mesmo
// tempo (a Visão Geral dispara 4–6 em paralelo). Todas esperam a MESMA
// renovação em vez de cada uma trocar o refresh token por conta própria.
export function renovarSessao() {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        accessToken = res.data.token;
        return res.data;
      })
      .finally(() => {
        renovacaoEmAndamento = null;
      });
  }
  return renovacaoEmAndamento;
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
