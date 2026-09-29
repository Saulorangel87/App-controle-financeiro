import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const CHAVE_TEMA = "tema";

function lerTemaPreferido() {
  const salvo = window.localStorage.getItem(CHAVE_TEMA);
  if (salvo === "claro" || salvo === "escuro") return salvo;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(lerTemaPreferido);

  // Mantém sincronizado com o script inline do index.html, que já aplica o
  // atributo antes do React montar (evita flash do tema errado).
  useEffect(() => {
    document.documentElement.dataset.theme = tema === "claro" ? "light" : "dark";
    window.localStorage.setItem(CHAVE_TEMA, tema);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema === "claro" ? "#f5f5f4" : "#0a0a0a");
  }, [tema]);

  function alternarTema() {
    // Classe temporária habilita a transição de cores só durante a troca.
    const raiz = document.documentElement;
    raiz.classList.add("transicao-tema");
    window.setTimeout(() => raiz.classList.remove("transicao-tema"), 400);
    setTema((atual) => (atual === "claro" ? "escuro" : "claro"));
  }

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
