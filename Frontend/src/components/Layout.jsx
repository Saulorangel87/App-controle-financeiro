import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useDespesaModal } from "../contexts/DespesaModalContext";
import "./Layout.css";
import Footer from "./Footer";

export default function Layout({ alertasCount }) {
  const { usuario, logout } = useAuth();
  const { abrirNovo } = useDespesaModal();
  const [menuAberto, setMenuAberto] = useState(false);

  function fecharMenu() {
    setMenuAberto(false);
  }

  const itemNav = ({ isActive }) => (isActive ? "nav-item active" : "nav-item");

  return (
    <div className="layout">
      <header className="header">
        <div className="header-row header-row-top">
          <div className="header-brand">
            <span className="label">Sistema</span>
            <h1 className="header-title">Controle de Despesas</h1>
          </div>
          <button
            className="botao-hamburguer"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuAberto}
          >
            {menuAberto ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className={`header-nav ${menuAberto ? "aberto" : ""}`} aria-label="Navegação principal">
          <NavLink to="/" end className={itemNav} onClick={fecharMenu}>
            Visão Geral
          </NavLink>
          <NavLink to="/despesas" className={itemNav} onClick={fecharMenu}>
            Despesas
          </NavLink>
          <NavLink to="/categorias" className={itemNav} onClick={fecharMenu}>
            Categorias
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
            <span className="label">{usuario?.nome}</span>
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
    </div>
  );
}
