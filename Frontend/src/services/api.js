import axios from "axios";

// URL do backend. Em dev aponta pro localhost; em produção, troque via
// variável de ambiente VITE_API_URL (ex: https://despesas-api.devsaulo.com.br/api)
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const api = axios.create({ baseURL });

// Anexa o token JWT salvo (se existir) em toda requisição
api.interceptors.request.use((config) => {
  const token = window.sessionStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Se o token expirar ou for inválido, limpa a sessão e manda pro login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      window.location.pathname !== "/login"
    ) {
      window.sessionStorage.removeItem("token");
      window.sessionStorage.removeItem("usuario");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
