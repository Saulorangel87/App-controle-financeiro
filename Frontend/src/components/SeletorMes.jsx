import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMes } from '../contexts/MesContext';
import { rotuloMes, somarMeses } from '../utils/datas';
import './SeletorMes.css';

export default function SeletorMes() {
  const { mes, mesAtual, ehMesAtual, mesMaximo, selecionarMes } = useMes();
  const situacao = ehMesAtual ? 'mês atual' : mes > mesAtual ? 'mês futuro' : 'mês passado';

  return (
    <div
      className={`seletor-mes ocultar-impressao ${ehMesAtual ? '' : 'fora-do-mes-atual'}`}
      role="group"
      aria-label="Mês exibido e dos novos lançamentos"
    >
      <div className="seletor-mes-controles">
        <button
          type="button"
          className="botao-icone"
          onClick={() => selecionarMes(somarMeses(mes, -1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="seletor-mes-rotulo" aria-live="polite">
          <strong>{rotuloMes(mes)}</strong>
          <span className="label">{situacao}</span>
        </div>
        <button
          type="button"
          className="botao-icone"
          onClick={() => selecionarMes(somarMeses(mes, 1))}
          disabled={mes >= mesMaximo}
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {!ehMesAtual && (
        <div className="seletor-mes-aviso">
          <span className="label">Novos lançamentos vão para {rotuloMes(mes)}.</span>
          <button type="button" className="seletor-mes-voltar" onClick={() => selecionarMes(mesAtual)}>
            Voltar para o mês atual
          </button>
        </div>
      )}
    </div>
  );
}
