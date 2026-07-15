import { createContext, useContext, useState } from 'react';
import ModalNovaDespesa from '../components/ModalNovaDespesa';

const DespesaModalContext = createContext(null);

export function DespesaModalProvider({ children, onSalvo }) {
  const [aberto, setAberto] = useState(false);
  const [despesaEditando, setDespesaEditando] = useState(null);

  function abrirNovo() {
    setDespesaEditando(null);
    setAberto(true);
  }

  function abrirEdicao(despesa) {
    setDespesaEditando(despesa);
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    setDespesaEditando(null);
  }

  return (
    <DespesaModalContext.Provider value={{ abrirNovo, abrirEdicao }}>
      {children}
      <ModalNovaDespesa
        aberto={aberto}
        despesaEditando={despesaEditando}
        onFechar={fechar}
        onSalvo={onSalvo}
      />
    </DespesaModalContext.Provider>
  );
}

export function useDespesaModal() {
  return useContext(DespesaModalContext);
}
