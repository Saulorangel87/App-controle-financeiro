import { createContext, useCallback, useContext, useState } from 'react';
import { MESES_A_FRENTE, mesAtualISO, somarMeses } from '../utils/datas';
import { useRecarregarAoVirarMes } from '../utils/useRecarregarAoVirarMes';

const MesContext = createContext(null);

// Mês escolhido no seletor do topo. Todas as telas do mês (Visão Geral,
// Categorias, Recorrentes, Alertas) e os formulários de lançamento usam
// este mês, como se ele tivesse virado. Não é salvo: o app sempre abre no
// mês corrente.
export function MesProvider({ children }) {
  // null = acompanhando o mês corrente, que avança sozinho na virada.
  const [mesEscolhido, setMesEscolhido] = useState(null);
  const [mesAtual, setMesAtual] = useState(mesAtualISO);

  useRecarregarAoVirarMes(useCallback(() => setMesAtual(mesAtualISO()), []));

  const selecionarMes = useCallback((novo) => {
    setMesEscolhido(novo === mesAtualISO() ? null : novo);
  }, []);

  const mes = mesEscolhido ?? mesAtual;
  const valor = {
    mes,
    mesAtual,
    ehMesAtual: mes === mesAtual,
    mesMaximo: somarMeses(mesAtual, MESES_A_FRENTE),
    selecionarMes,
  };

  return <MesContext.Provider value={valor}>{children}</MesContext.Provider>;
}

// Fora do provider (ex: uma página renderizada sozinha num teste), fica no
// mês corrente.
export function useMes() {
  const contexto = useContext(MesContext);
  if (contexto) return contexto;
  const mesAtual = mesAtualISO();
  return {
    mes: mesAtual,
    mesAtual,
    ehMesAtual: true,
    mesMaximo: somarMeses(mesAtual, MESES_A_FRENTE),
    selecionarMes: () => {},
  };
}
