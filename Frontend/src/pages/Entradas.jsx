import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, History, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';
import ModalEntrada from '../components/ModalEntrada';
import { useMes } from '../contexts/MesContext';
import { rotuloMes } from '../utils/datas';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Despesas.css';

const POR_PAGINA = 20;

export default function Entradas() {
  const { mes } = useMes();
  const [dados, setDados] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  // Mesma regra de Despesas: abre sempre filtrada no mês do seletor (o
  // atual, por padrão). "Todos os meses" continua no filtro.
  const [mesSelecionado, setMesSelecionado] = useState(mes);
  const [meses, setMeses] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [entradaEditando, setEntradaEditando] = useState(null);
  const [itemExcluido, setItemExcluido] = useState(null);

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
    setMesSelecionado(mes);
    setPagina(1);
  }, [mes]);

  useEffect(() => {
    carregar(pagina);
  }, [carregar, pagina]);

  function abrirNova() {
    setEntradaEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(entrada) {
    setEntradaEditando(entrada);
    setModalAberto(true);
  }

  function entradaSalva() {
    carregarMeses();
    carregar(pagina);
  }

  async function excluir(id) {
    const entrada = dados?.entradas.find((item) => item.id === id);
    await api.delete(`/entradas/${id}`);
    setItemExcluido({ id, origem: entrada?.origem || 'Entrada' });
    carregarMeses();
    if (dados.entradas.length === 1 && pagina > 1) {
      setPagina((p) => p - 1);
    } else {
      carregar(pagina);
    }
  }

  async function desfazerExclusao() {
    if (!itemExcluido) return;
    await api.post('/historico/desfazer', { tabela: 'entradas', registro_id: itemExcluido.id });
    setItemExcluido(null);
    carregarMeses();
    carregar(pagina);
  }

  if (carregando || !dados) return <p className="label">Carregando...</p>;

  const { entradas, total, totalGeral, totalPaginas } = dados;
  const opcoesMes = !mesSelecionado || meses.includes(mesSelecionado)
    ? meses
    : [...meses, mesSelecionado].sort().reverse();

  return (
    <div className="despesas-e-entradas">
      <div className="panel despesas-panel entradas-registro">
        {itemExcluido && (
          <div className="aviso-desfazer" role="status">
            <span className="label">Entrada &ldquo;{itemExcluido.origem}&rdquo; excluída.</span>
            <button type="button" className="botao-desfazer" onClick={desfazerExclusao}>
              Desfazer
            </button>
          </div>
        )}
        <div className="despesas-header">
          <div className="despesas-header-titulo">
            <span className="label">{mesSelecionado ? `Entradas de ${rotuloMes(mesSelecionado)}` : 'Todas as Entradas'} — {total} registros</span>
            <label className="sr-only" htmlFor="filtro-mes-entradas">Filtrar entradas por mês</label>
            <select id="filtro-mes-entradas" className="filtro-mes" value={mesSelecionado} onChange={(evento) => { setMesSelecionado(evento.target.value); setPagina(1); }}>
              <option value="">Todos os meses</option>
              {opcoesMes.map((opcao) => <option key={opcao} value={opcao}>{rotuloMes(opcao)}</option>)}
            </select>
          </div>
          <div className="despesas-header-acoes">
            <button type="button" className="botao-importar" onClick={abrirNova}>
              <Plus size={14} /> Nova Entrada
            </button>
            <Link to="/historico" className="botao-importar">
              <History size={13} /> Histórico
            </Link>
            <span className="label">
              Total: <strong style={{ color: 'var(--ok)' }}>+{formatarMoeda(totalGeral)}</strong>
            </span>
          </div>
        </div>

        <div className="tabela-despesas">
          <div className="linha linha-entrada linha-cabecalho">
            <span className="label">Data</span>
            <span className="label">Origem</span>
            <span className="label">Descrição</span>
            <span className="label" style={{ textAlign: 'right' }}>Valor</span>
            <span />
            <span />
          </div>

          {entradas.map((entrada) => (
            <div className="linha linha-entrada" key={entrada.id}>
              <span className="celula-data">{formatarData(entrada.data)}</span>
              <strong className="celula-origem-entrada" title={entrada.origem}>{entrada.origem}</strong>
              <span className="celula-descricao-entrada">{entrada.descricao || '—'}</span>
              <span className="celula-valor" style={{ color: 'var(--ok)' }}>+{formatarMoeda(entrada.valor)}</span>
              <button className="botao-icone" onClick={() => abrirEdicao(entrada)} aria-label={`Editar entrada ${entrada.origem}`}>
                <Pencil size={14} />
              </button>
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

      <ModalEntrada
        aberto={modalAberto}
        entradaEditando={entradaEditando}
        onFechar={() => {
          setModalAberto(false);
          setEntradaEditando(null);
        }}
        onSalvo={entradaSalva}
      />
    </div>
  );
}
