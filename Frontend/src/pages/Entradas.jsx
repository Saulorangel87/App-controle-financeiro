import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import api from '../services/api';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Despesas.css';

const POR_PAGINA = 20;

function rotuloMes(mes) {
  return new Date(`${mes}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function Entradas() {
  const [dados, setDados] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [meses, setMeses] = useState([]);

  const carregar = useCallback(async (paginaAlvo) => {
    setCarregando(true);
    const res = await api.get('/entradas', {
      params: {
        pagina: paginaAlvo,
        porPagina: POR_PAGINA,
        ...(mesSelecionado ? { mes: mesSelecionado } : {}),
      },
    });
    setDados(res.data);
    setCarregando(false);
  }, [mesSelecionado]);

  const carregarMeses = useCallback(() => {
    api.get('/entradas/meses').then((res) => setMeses(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    carregarMeses();
  }, [carregarMeses]);

  useEffect(() => {
    carregar(pagina);
  }, [carregar, pagina]);

  async function excluir(id) {
    const entrada = dados?.entradas.find((item) => item.id === id);
    if (!window.confirm(`Tem certeza que deseja excluir a entrada "${entrada?.origem || ''}"?`)) return;
    await api.delete(`/entradas/${id}`);
    carregarMeses();
    if (dados.entradas.length === 1 && pagina > 1) {
      setPagina((p) => p - 1);
    } else {
      carregar(pagina);
    }
  }

  if (carregando || !dados) return <p className="label">Carregando...</p>;

  const { entradas, total, totalGeral, totalPaginas } = dados;

  return (
    <div className="despesas-e-entradas">
      <div className="panel despesas-panel entradas-registro">
        <div className="despesas-header">
          <div className="despesas-header-titulo">
            <span className="label">{mesSelecionado ? `Entradas de ${rotuloMes(mesSelecionado)}` : 'Todas as Entradas'} — {total} registros</span>
            <label className="sr-only" htmlFor="filtro-mes-entradas">Filtrar entradas por mês</label>
            <select id="filtro-mes-entradas" className="filtro-mes" value={mesSelecionado} onChange={(evento) => { setMesSelecionado(evento.target.value); setPagina(1); }}>
              <option value="">Todos os meses</option>
              {meses.map((mes) => <option key={mes} value={mes}>{rotuloMes(mes)}</option>)}
            </select>
          </div>
          <span className="label">
            Total: <strong style={{ color: 'var(--ok)' }}>+{formatarMoeda(totalGeral)}</strong>
          </span>
        </div>

        <div className="tabela-despesas">
          <div className="linha linha-entrada linha-cabecalho">
            <span className="label">Data</span>
            <span className="label">Origem</span>
            <span className="label">Descrição</span>
            <span className="label" style={{ textAlign: 'right' }}>Valor</span>
            <span />
          </div>

          {entradas.map((entrada) => (
            <div className="linha linha-entrada" key={entrada.id}>
              <span className="celula-data">{formatarData(entrada.data)}</span>
              <strong className="celula-origem-entrada" title={entrada.origem}>{entrada.origem}</strong>
              <span className="celula-descricao-entrada">{entrada.descricao || '—'}</span>
              <span className="celula-valor" style={{ color: 'var(--ok)' }}>+{formatarMoeda(entrada.valor)}</span>
              <button className="botao-excluir" onClick={() => excluir(entrada.id)} aria-label={`Excluir entrada ${entrada.origem}`}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {entradas.length === 0 && (
            <p className="label" style={{ padding: '24px 0' }}>Nenhuma entrada cadastrada ainda.</p>
          )}
        </div>

        {totalPaginas > 1 && (
          <div className="paginacao">
            <button className="botao-icone" onClick={() => setPagina((p) => p - 1)} disabled={pagina <= 1} aria-label="Página anterior de entradas">
              <ChevronLeft size={16} />
            </button>
            <span className="label">Página {pagina} de {totalPaginas}</span>
            <button className="botao-icone" onClick={() => setPagina((p) => p + 1)} disabled={pagina >= totalPaginas} aria-label="Próxima página de entradas">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
