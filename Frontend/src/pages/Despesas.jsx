import { useCallback, useEffect, useState } from 'react';
import { Pencil, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { useDespesaModal } from '../contexts/DespesaModalContext';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Despesas.css';

const POR_PAGINA = 20;
const POR_PAGINA_ENTRADAS = 10;

export default function Despesas() {
  const [dados, setDados] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [dadosEntradas, setDadosEntradas] = useState(null);
  const [paginaEntradas, setPaginaEntradas] = useState(1);
  const { abrirEdicao } = useDespesaModal();

  const carregar = useCallback(async (paginaAlvo) => {
    setCarregando(true);
    const res = await api.get('/despesas', { params: { pagina: paginaAlvo, porPagina: POR_PAGINA } });
    setDados(res.data);
    setCarregando(false);
  }, []);

  const carregarEntradas = useCallback(async (paginaAlvo) => {
    const res = await api.get('/entradas', { params: { pagina: paginaAlvo, porPagina: POR_PAGINA_ENTRADAS } });
    setDadosEntradas(res.data);
  }, []);

  useEffect(() => {
    carregar(pagina);
  }, [carregar, pagina]);

  useEffect(() => {
    carregarEntradas(paginaEntradas);
  }, [carregarEntradas, paginaEntradas]);

  async function excluir(id) {
    await api.delete(`/despesas/${id}`);
    // Se era o último registro da página (e não é a primeira página), volta
    // uma página — senão a tela fica "vazia" mostrando uma página inexistente.
    if (dados.despesas.length === 1 && pagina > 1) {
      setPagina((p) => p - 1);
    } else {
      carregar(pagina);
    }
  }

  async function excluirEntrada(id) {
    await api.delete(`/entradas/${id}`);
    if (dadosEntradas.entradas.length === 1 && paginaEntradas > 1) {
      setPaginaEntradas((p) => p - 1);
    } else {
      carregarEntradas(paginaEntradas);
    }
  }

  if (carregando || !dados) return <p className="label">Carregando...</p>;

  const { despesas, total, totalGeral, totalPaginas } = dados;
  const entradas = dadosEntradas?.entradas || [];
  const totalEntradasReg = dadosEntradas?.total || 0;
  const totalEntradasValor = dadosEntradas?.totalGeral || 0;
  const totalPaginasEntradas = dadosEntradas?.totalPaginas || 1;

  return (
    <div className="despesas-e-entradas">
      <div className="panel despesas-panel">
        <div className="despesas-header">
          <span className="label">Todas as Despesas — {total} registros</span>
          <span className="label">
            Total: <strong style={{ color: 'var(--text-primary)' }}>{formatarMoeda(totalGeral)}</strong>
          </span>
        </div>

        <div className="tabela-despesas">
          <div className="linha linha-cabecalho">
            <span className="label">Data</span>
            <span className="label">Descrição</span>
            <span className="label">Categoria</span>
            <span className="label" style={{ textAlign: 'right' }}>Valor</span>
            <span />
            <span />
          </div>

          {despesas.map((d) => (
            <div className="linha" key={d.id}>
              <span className="celula-data">{formatarData(d.data)}</span>
              <strong title={d.descricao}>{d.descricao}</strong>
              <span className="celula-categoria" style={{ color: d.categoria_cor }}>
                <IconeCategoria nome={d.categoria_icone} size={14} />
                {d.categoria_nome}
              </span>
              <span className="celula-valor">-{formatarMoeda(d.valor)}</span>
              <button className="botao-icone" onClick={() => abrirEdicao(d)} aria-label="Editar despesa">
                <Pencil size={14} />
              </button>
              <button className="botao-excluir" onClick={() => excluir(d.id)} aria-label="Excluir despesa">
                ×
              </button>
            </div>
          ))}

          {despesas.length === 0 && (
            <p className="label" style={{ padding: '24px 0' }}>Nenhuma despesa cadastrada ainda.</p>
          )}
        </div>

        {totalPaginas > 1 && (
          <div className="paginacao">
            <button
              className="botao-icone"
              onClick={() => setPagina((p) => p - 1)}
              disabled={pagina <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="label">Página {pagina} de {totalPaginas}</span>
            <button
              className="botao-icone"
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina >= totalPaginas}
              aria-label="Próxima página"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Entradas (adições ao orçamento) ficam num painel à parte — não se
          misturam com as despesas, são um registro separado de dinheiro que
          entrou, não de dinheiro gasto. */}
      <div className="panel despesas-panel entradas-registro">
        <div className="despesas-header">
          <span className="label">Entradas Registradas — {totalEntradasReg} registros</span>
          <span className="label">
            Total: <strong style={{ color: 'var(--ok)' }}>+{formatarMoeda(totalEntradasValor)}</strong>
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

          {entradas.map((e) => (
            <div className="linha linha-entrada" key={e.id}>
              <span className="celula-data">{formatarData(e.data)}</span>
              <strong title={e.origem}>{e.origem}</strong>
              <span className="celula-descricao-entrada">{e.descricao || '—'}</span>
              <span className="celula-valor" style={{ color: 'var(--ok)' }}>+{formatarMoeda(e.valor)}</span>
              <button className="botao-excluir" onClick={() => excluirEntrada(e.id)} aria-label={`Excluir entrada ${e.origem}`}>
                <X size={16} />
              </button>
            </div>
          ))}

          {entradas.length === 0 && (
            <p className="label" style={{ padding: '24px 0' }}>Nenhuma entrada registrada ainda.</p>
          )}
        </div>

        {totalPaginasEntradas > 1 && (
          <div className="paginacao">
            <button
              className="botao-icone"
              onClick={() => setPaginaEntradas((p) => p - 1)}
              disabled={paginaEntradas <= 1}
              aria-label="Página anterior de entradas"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="label">Página {paginaEntradas} de {totalPaginasEntradas}</span>
            <button
              className="botao-icone"
              onClick={() => setPaginaEntradas((p) => p + 1)}
              disabled={paginaEntradas >= totalPaginasEntradas}
              aria-label="Próxima página de entradas"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
