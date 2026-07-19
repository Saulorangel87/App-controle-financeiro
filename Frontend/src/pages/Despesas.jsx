import { useCallback, useEffect, useState } from 'react';
import { Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { useDespesaModal } from '../contexts/DespesaModalContext';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Despesas.css';

const POR_PAGINA = 20;

export default function Despesas() {
  const [dados, setDados] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const { abrirEdicao } = useDespesaModal();

  const carregar = useCallback(async (paginaAlvo) => {
    setCarregando(true);
    const res = await api.get('/despesas', { params: { pagina: paginaAlvo, porPagina: POR_PAGINA } });
    setDados(res.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar(pagina);
  }, [carregar, pagina]);

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

  if (carregando || !dados) return <p className="label">Carregando...</p>;

  const { despesas, total, totalGeral, totalPaginas } = dados;

  return (
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
  );
}
