import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useDespesaModal } from "../contexts/DespesaModalContext";
import { useTheme } from "../contexts/ThemeContext";
import "./Layout.css";
import Footer from "./Footer";
import AvisoNovidades from "./AvisoNovidades";

export default function Layout({ alertasCount }) {
  const { usuario, logout } = useAuth();
  const { abrirNovo } = useDespesaModal();
  const { tema, alternarTema } = useTheme();
  const [menuAberto, setMenuAberto] = useState(false);

  function fecharMenu() {
    setMenuAberto(false);
  }

  const itemNav = ({ isActive }) => (isActive ? "nav-item active" : "nav-item");

  return (
    <div className="layout">
      <header className="header ocultar-impressao">
        <div className="header-row header-row-top">
          <div className="header-brand">
            <span className="label">Sistema</span>
            <h1 className="header-title">Controle de Despesas</h1>
          </div>
          <div className="header-acoes-topo">
            <button
              className="botao-icone botao-tema"
              onClick={alternarTema}
              aria-label={tema === "claro" ? "Ativar tema escuro" : "Ativar tema claro"}
              title={tema === "claro" ? "Ativar tema escuro" : "Ativar tema claro"}
            >
              {tema === "claro" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="botao-hamburguer"
              onClick={() => setMenuAberto((v) => !v)}
              aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuAberto}
            >
              {menuAberto ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <nav className={`header-nav ${menuAberto ? "aberto" : ""}`} aria-label="Navegação principal">
          <NavLink to="/" end className={itemNav} onClick={fecharMenu}>
            Visão Geral
          </NavLink>
          <NavLink to="/despesas" className={itemNav} onClick={fecharMenu}>
            Despesas
          </NavLink>
          <NavLink to="/entradas" className={itemNav} onClick={fecharMenu}>
            Entradas
          </NavLink>
          <NavLink to="/categorias" className={itemNav} onClick={fecharMenu}>
            Categorias
          </NavLink>
          <NavLink to="/recorrentes" className={itemNav} onClick={fecharMenu}>
            Recorrentes
          </NavLink>
          <NavLink to="/metas" className={itemNav} onClick={fecharMenu}>
            Metas
          </NavLink>
          <NavLink to="/alertas" className={itemNav} onClick={fecharMenu}>
            Alertas {alertasCount != null ? `[${alertasCount}]` : ""}
          </NavLink>
          <NavLink to="/relatorio" className={itemNav} onClick={fecharMenu}>
            Relatório
          </NavLink>
        </nav>

        <div className="header-row header-row-bottom">
          <div className="header-usuario">
            <NavLink to="/conta" className="label" onClick={fecharMenu}>
              {usuario?.nome}
            </NavLink>
            <button className="botao-sair" onClick={logout}>
              Sair
            </button>
          </div>

          <button className="btn-primary header-add" onClick={abrirNovo}>
            + Adicionar
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
      <Footer />
      <AvisoNovidades />
    </div>
  );
}
