import { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import api from '../services/api';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Historico.css';

const ACOES = { criar: 'Criada', editar: 'Editada', excluir: 'Excluída' };
const TABELAS = { despesas: 'Despesa', entradas: 'Entrada' };

// O histórico guarda a linha inteira do banco em JSON; o valor em centavos
// é o confiável (o decimal é legado, ver utils/dinheiro.js no backend).
function valorDe(registro) {
  if (!registro) return null;
  return Number.isInteger(registro.valor_centavos) ? registro.valor_centavos / 100 : registro.valor;
}

function nomeDe(registro, tabela) {
  if (!registro) return '';
  return tabela === 'entradas' ? registro.origem : registro.descricao;
}

function quandoFoi(criadoEm) {
  // criado_em vem do SQLite em UTC ("YYYY-MM-DD HH:MM:SS"), sem o "Z".
  return new Date(`${criadoEm.replace(' ', 'T')}Z`).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function detalheDaEdicao(antes, depois, tabela) {
  const mudancas = [];
  if (nomeDe(antes, tabela) !== nomeDe(depois, tabela)) {
    mudancas.push(`${nomeDe(antes, tabela)} → ${nomeDe(depois, tabela)}`);
  }
  if (valorDe(antes) !== valorDe(depois)) {
    mudancas.push(`${formatarMoeda(valorDe(antes))} → ${formatarMoeda(valorDe(depois))}`);
  }
  if (antes.data !== depois.data) {
    mudancas.push(`${formatarData(antes.data)} → ${formatarData(depois.data)}`);
  }
  return mudancas.join(' · ') || 'outros detalhes alterados';
}

export default function Historico() {
  const [itens, setItens] = useState(null);
  const [acao, setAcao] = useState('');
  const [tabela, setTabela] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [restaurando, setRestaurando] = useState(null);

  const carregar = useCallback(async () => {
    const res = await api.get('/historico', {
      params: { limite: 100, ...(acao ? { acao } : {}), ...(tabela ? { tabela } : {}) },
    });
    setItens(res.data);
  }, [acao, tabela]);

  useEffect(() => {
    carregar().catch(() => setMensagem('Não foi possível carregar o histórico.'));
  }, [carregar]);

  async function restaurar(item) {
    setRestaurando(item.id);
    setMensagem('');
    try {
      await api.post(`/historico/${item.id}/desfazer`);
      setMensagem(`${TABELAS[item.tabela]} “${nomeDe(item.dados_antes, item.tabela)}” restaurada.`);
      await carregar();
    } catch (err) {
      setMensagem(err.response?.data?.erro || 'Não foi possível restaurar. Tente novamente.');
    } finally {
      setRestaurando(null);
    }
  }

  if (!itens) return <p className="label">{mensagem || 'Carregando...'}</p>;

  return (
    <div className="panel historico-panel">
      <div className="historico-header">
        <span className="label">Histórico de alterações — últimas {itens.length}</span>
        <div className="historico-filtros">
          <label className="sr-only" htmlFor="historico-acao">Filtrar por ação</label>
          <select id="historico-acao" className="historico-filtro" value={acao} onChange={(e) => setAcao(e.target.value)}>
            <option value="">Todas as ações</option>
            <option value="criar">Criações</option>
            <option value="editar">Edições</option>
            <option value="excluir">Exclusões</option>
          </select>
          <label className="sr-only" htmlFor="historico-tabela">Filtrar por tipo</label>
          <select id="historico-tabela" className="historico-filtro" value={tabela} onChange={(e) => setTabela(e.target.value)}>
            <option value="">Despesas e entradas</option>
            <option value="despesas">Só despesas</option>
            <option value="entradas">Só entradas</option>
          </select>
        </div>
      </div>

      <p className="historico-status" role="status">{mensagem}</p>

      {itens.length === 0 ? (
        <p className="label historico-vazio">Nenhuma alteração registrada com esses filtros.</p>
      ) : (
        <ul className="lista-historico">
          {itens.map((item) => {
            const registro = item.dados_depois || item.dados_antes;
            return (
              <li key={item.id} className="item-historico">
                <span className={`badge-acao acao-${item.acao}`}>{TABELAS[item.tabela]} {ACOES[item.acao].toLowerCase()}</span>
                <div className="item-historico-info">
                  <strong>{nomeDe(registro, item.tabela)}</strong>
                  <span className="label">
                    {item.acao === 'editar' && item.dados_antes && item.dados_depois
                      ? detalheDaEdicao(item.dados_antes, item.dados_depois, item.tabela)
                      : `${formatarMoeda(valorDe(registro))} · ${formatarData(registro.data)}`}
                  </span>
                </div>
                <span className="label item-historico-quando">{quandoFoi(item.criado_em)}</span>
                {item.acao === 'excluir' ? (
                  <button
                    type="button"
                    className="botao-restaurar"
                    onClick={() => restaurar(item)}
                    disabled={restaurando === item.id}
                    aria-label={`Restaurar ${nomeDe(registro, item.tabela)}`}
                  >
                    <RotateCcw size={12} /> Restaurar
                  </button>
                ) : <span />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
