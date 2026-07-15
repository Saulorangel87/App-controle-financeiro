import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const token = window.sessionStorage.getItem("token");
    if (!token) {
      setCarregando(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUsuario(res.data.usuario))
      .catch(() => {
        window.sessionStorage.removeItem("token");
        window.sessionStorage.removeItem("usuario");
      })
      .finally(() => setCarregando(false));
  }, []);

  async function login(email, senha) {
    const res = await api.post("/auth/login", { email, senha });
    window.sessionStorage.setItem("token", res.data.token);
    window.sessionStorage.setItem("usuario", JSON.stringify(res.data.usuario));
    setUsuario(res.data.usuario);
  }

  async function registrar(nome, email, senha) {
    const res = await api.post("/auth/registrar", { nome, email, senha });
    window.sessionStorage.setItem("token", res.data.token);
    window.sessionStorage.setItem("usuario", JSON.stringify(res.data.usuario));
    setUsuario(res.data.usuario);
  }

  function logout() {
    window.sessionStorage.removeItem("token");
    window.sessionStorage.removeItem("usuario");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, login, registrar, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
