import { useEffect, useRef } from 'react';

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Detecta quando o mês vira (relógio do navegador) enquanto a aba continua
 * aberta e chama `recarregar` pra buscar os dados de novo do servidor.
 *
 * Sem isso, quem deixa o dashboard aberto passando da meia-noite do último
 * dia do mês continuaria vendo os totais "congelados" do mês anterior até
 * dar F5 manualmente — já que /resumo e /categorias agora só consideram o
 * mês corrente, a virada real do mês só é percebida numa nova chamada à API.
 *
 * A checagem roda por intervalo (a cada 1 min) e também quando a aba volta
 * a ficar em foco/visível, que é o momento mais comum de "flagrar" a virada.
 */
export function useRecarregarAoVirarMes(recarregar) {
  const mesRef = useRef(mesAtualISO());

  useEffect(() => {
    function verificarVirada() {
      const mesAgora = mesAtualISO();
      if (mesAgora !== mesRef.current) {
        mesRef.current = mesAgora;
        recarregar();
      }
    }

    const intervalo = setInterval(verificarVirada, 60_000);
    window.addEventListener('focus', verificarVirada);
    document.addEventListener('visibilitychange', verificarVirada);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', verificarVirada);
      document.removeEventListener('visibilitychange', verificarVirada);
    };
  }, [recarregar]);
}
