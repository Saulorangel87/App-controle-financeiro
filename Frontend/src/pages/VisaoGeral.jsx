import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import ModalEntrada from '../components/ModalEntrada';
import { useDespesaModal } from '../contexts/DespesaModalContext';
import { formatarMoeda, formatarData } from '../utils/formatters';
import { useRecarregarAoVirarMes } from '../utils/useRecarregarAoVirarMes';
import './VisaoGeral.css';

// Mesmo corte usado no resto do app pra "tela de celular" (Alertas.css usa o
// mesmo valor). Abaixo disso, a barra com 8 categorias fica ilegível — os
// rótulos espremem e uma categoria com valor muito maior que as outras faz
// as demais desaparecerem no gráfico (eixo linear).
const LARGURA_MOBILE = 600;

// A partir de 3 lançamentos, o painel "Entradas do Mês" pagina — evita que
// a Visão Geral fique gigante no celular quando a pessoa registra várias
// entradas no mesmo mês.
const POR_PAGINA_ENTRADAS = 3;

function useEhMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= LARGURA_MOBILE
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${LARGURA_MOBILE}px)`);
    const atualizar = () => setMobile(mql.matches);
    mql.addEventListener('change', atualizar);
    return () => mql.removeEventListener('change', atualizar);
  }, []);

  return mobile;
}

export default function VisaoGeral() {
  const [resumo, setResumo] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoOrcamento, setEditandoOrcamento] = useState(false);
  const [novoOrcamento, setNovoOrcamento] = useState('');
  const [orcamentoRecorrente, setOrcamentoRecorrente] = useState(false);
  const [editandoFechamento, setEditandoFechamento] = useState(false);
  const [novoDiaFechamento, setNovoDiaFechamento] = useState('');
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [entradaEditando, setEntradaEditando] = useState(null);
  const [paginaEntradas, setPaginaEntradas] = useState(1);
  const [itemExcluido, setItemExcluido] = useState(null);
  const { abrirEdicao } = useDespesaModal();
  const ehMobile = useEhMobile();

  async function carregarResumo() {
    const res = await api.get('/resumo');
    setResumo(res.data);
  }

  async function carregarEntradas() {
    const res = await api.get('/entradas');
    setEntradas(res.data);
  }

  const carregarTudo = useCallback(async () => {
    const [resResumo, resCategorias, resDespesas, resEntradas] = await Promise.all([
      api.get('/resumo'),
      api.get('/categorias'),
      api.get('/despesas', { params: { pagina: 1, porPagina: 4 } }),
      api.get('/entradas'),
    ]);
    setResumo(resResumo.data);
    setCategorias(resCategorias.data);
    setDespesas(resDespesas.data.despesas);
    setEntradas(resEntradas.data);
    setCarregando(false);
  }, []);

  async function excluirEntrada(id) {
    const entrada = entradas.find((e) => e.id === id);
    await api.delete(`/entradas/${id}`);
    setItemExcluido({ tabela: 'entradas', id, rotulo: `Entrada "${entrada?.origem || 'Entrada'}"` });
    carregarEntradas();
    carregarResumo();
    setPaginaEntradas(1);
  }

  async function excluirDespesa(despesa) {
    if (!window.confirm(`Tem certeza que deseja excluir a despesa "${despesa.descricao}"?`)) return;
    await api.delete(`/despesas/${despesa.id}`);
    setItemExcluido({ tabela: 'despesas', id: despesa.id, rotulo: `Despesa "${despesa.descricao}"` });
    carregarTudo();
  }

  async function desfazerExclusao() {
    if (!itemExcluido) return;
    await api.post('/historico/desfazer', { tabela: itemExcluido.tabela, registro_id: itemExcluido.id });
    setItemExcluido(null);
    carregarTudo();
  }

  function entradaSalva() {
    carregarEntradas();
    carregarResumo();
    setPaginaEntradas(1);
  }

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Se o mês virar com a aba aberta, recarrega tudo — o dashboard não fica
  // "preso" mostrando os totais do mês que já passou.
  useRecarregarAoVirarMes(carregarTudo);

  function abrirEdicaoOrcamento() {
    setNovoOrcamento(String(resumo.orcamentoTotal));
    setOrcamentoRecorrente(Boolean(resumo.orcamentoRecorrente));
    setEditandoOrcamento(true);
  }

  async function salvarOrcamento() {
    await api.put('/orcamento', { valor: Number(novoOrcamento), recorrente: orcamentoRecorrente });
    setEditandoOrcamento(false);
    carregarResumo();
  }

  async function repetirOrcamentoAnterior() {
    await api.put('/orcamento', { valor: resumo.orcamentoMesAnterior, recorrente: true });
    carregarResumo();
  }

  function abrirEdicaoFechamento() {
    setNovoDiaFechamento(resumo.faturaCartao?.diaFechamento ? String(resumo.faturaCartao.diaFechamento) : '');
    setEditandoFechamento(true);
  }

  async function salvarFechamentoCartao() {
    const limpo = novoDiaFechamento.trim();
    const dia = limpo === '' ? null : Number(limpo);
    await api.put('/orcamento/cartao', { dia_fechamento: dia });
    setEditandoFechamento(false);
    carregarResumo();
  }

  if (carregando) return <p className="label">Carregando...</p>;

  const dadosGrafico = resumo.gastoPorCategoria.map((c) => ({
    nome: c.nome,
    gasto: c.gasto,
    limite: c.limite,
    cor: categorias.find((cat) => cat.nome === c.nome)?.cor || 'var(--accent)',
  }));
  const dadosComGasto = dadosGrafico.filter((c) => c.gasto > 0);

  const percentual = Math.min(resumo.percentualUtilizado, 100);
  const corBarra =
    resumo.percentualUtilizado >= 100
      ? 'var(--danger)'
      : resumo.percentualUtilizado >= 90
      ? 'var(--warning)'
      : 'var(--accent)';
  const totalPaginasEntradas = Math.max(1, Math.ceil(entradas.length / POR_PAGINA_ENTRADAS));

  return (
    <div className="visao-geral">
      {itemExcluido && (
        <div className="aviso-desfazer-dashboard" role="status">
          <span className="label">{itemExcluido.rotulo} excluída.</span>
          <button type="button" className="botao-desfazer-dashboard" onClick={desfazerExclusao}>
            Desfazer
          </button>
        </div>
      )}
      <div className="cards-resumo">
        <div className="panel card-resumo">
          <span className="label">Total Gasto</span>
          <strong className="valor" style={{ color: 'var(--accent)' }}>
            {formatarMoeda(resumo.totalGasto)}
          </strong>
        </div>
        <div className="panel card-resumo">
          <div className="card-resumo-header">
            <span className="label">Orçamento Total</span>
            {!editandoOrcamento && (
              <div className="acoes-orcamento">
                <button
                  className="botao-icone botao-adicionar-valor"
                  onClick={() => {
                    setEntradaEditando(null);
                    setModalEntradaAberto(true);
                  }}
                  aria-label="Adicionar valor ao orçamento"
                  title="Adicionar valor"
                >
                  <Plus size={14} />
                </button>
                <button className="botao-editar-inline" onClick={abrirEdicaoOrcamento} aria-label="Editar orçamento total">
                  editar
                </button>
              </div>
            )}
          </div>
          {editandoOrcamento ? (
            <div className="edicao-orcamento-bloco">
              <div className="edicao-orcamento">
                <label className="sr-only" htmlFor="input-orcamento-total">Novo orçamento total</label>
                <input
                  id="input-orcamento-total"
                  type="number"
                  step="0.01"
                  value={novoOrcamento}
                  onChange={(e) => setNovoOrcamento(e.target.value)}
                  className="input-limite"
                  autoFocus
                />
                <button className="btn-primary" onClick={salvarOrcamento}>Salvar</button>
              </div>
              <label className="checkbox-orcamento-recorrente" htmlFor="check-orcamento-recorrente">
                <input
                  id="check-orcamento-recorrente"
                  type="checkbox"
                  checked={orcamentoRecorrente}
                  onChange={(e) => setOrcamentoRecorrente(e.target.checked)}
                />
                Repetir todo mês
              </label>
            </div>
          ) : (
            <>
              <strong className="valor" style={{ color: 'var(--ok)' }}>
                {formatarMoeda(resumo.orcamentoTotal)}
              </strong>
              {resumo.orcamentoRecorrente && (
                <span className="label legenda-orcamento">repete todo mês</span>
              )}
              {resumo.orcamentoTotal === 0 && resumo.orcamentoMesAnterior > 0 && (
                <button
                  type="button"
                  className="botao-editar-inline botao-repetir-orcamento"
                  onClick={repetirOrcamentoAnterior}
                >
                  Repetir mês anterior ({formatarMoeda(resumo.orcamentoMesAnterior)})
                </button>
              )}
            </>
          )}
        </div>
        <div className="panel card-resumo">
          <span className="label">Disponível</span>
          <strong className="valor" style={{ color: 'var(--warning)' }}>
            {formatarMoeda(resumo.disponivel)}
          </strong>
        </div>
        <div className="panel card-resumo">
          <span className="label">Categorias c/ Alerta</span>
          <strong className="valor" style={{ color: 'var(--danger)' }}>
            {resumo.categoriasComAlerta}
          </strong>
        </div>
      </div>

      <div className="panel bloco-orcamento">
        <div className="bloco-orcamento-header">
          <span className="label">Utilização do Orçamento</span>
          <span className="label" style={{ color: corBarra }}>{resumo.percentualUtilizado}%</span>
        </div>
        <div className="barra-fundo">
          <div className="barra-preenchida" style={{ width: `${percentual}%`, background: corBarra }} />
        </div>
        <div className="bloco-orcamento-footer">
          <span className="label">{formatarMoeda(resumo.totalGasto)} gastos</span>
          <span className="label">limite {formatarMoeda(resumo.orcamentoTotal)}</span>
        </div>
        {resumo.projecaoMes > 0 && (
          <p
            className="label projecao-mes"
            style={{
              color: resumo.orcamentoTotal > 0 && resumo.projecaoMes > resumo.orcamentoTotal
                ? 'var(--danger)'
                : 'var(--text-secondary)',
            }}
          >
            No ritmo atual ({resumo.diaAtual}/{resumo.diasNoMes} dias), você deve gastar{' '}
            <strong>{formatarMoeda(resumo.projecaoMes)}</strong> até o fim do mês
            {resumo.orcamentoTotal > 0
              ? resumo.projecaoMes > resumo.orcamentoTotal
                ? ` (${formatarMoeda(resumo.projecaoMes - resumo.orcamentoTotal)} acima do orçamento)`
                : ` (${formatarMoeda(resumo.orcamentoTotal - resumo.projecaoMes)} abaixo do orçamento)`
              : ''}
          </p>
        )}
      </div>

      {resumo.faturaCartao && (
        <div className="panel bloco-fatura-cartao">
          <div className="bloco-fatura-header">
            <div className="bloco-fatura-info">
              <span className="label">Fatura do Cartão (Crédito)</span>
              <span className="label legenda-ciclo-cartao">
                Ciclo: {formatarData(resumo.faturaCartao.inicioCiclo)} a {formatarData(resumo.faturaCartao.fimCiclo)}
                {' · '}
                {resumo.faturaCartao.quantidade} compra{resumo.faturaCartao.quantidade === 1 ? '' : 's'}
              </span>
            </div>
            <div className="bloco-fatura-direita">
              <strong className="valor" style={{ color: 'var(--accent)' }}>
                {formatarMoeda(resumo.faturaCartao.total)}
              </strong>
              {!editandoFechamento ? (
                <button
                  type="button"
                  className="botao-editar-inline"
                  onClick={abrirEdicaoFechamento}
                  aria-label="Configurar dia de fechamento do cartão"
                >
                  {resumo.faturaCartao.diaFechamento
                    ? `fecha dia ${resumo.faturaCartao.diaFechamento}`
                    : 'definir fechamento'}
                </button>
              ) : (
                <div className="edicao-orcamento edicao-fechamento">
                  <label className="sr-only" htmlFor="input-dia-fechamento">Dia de fechamento do cartão</label>
                  <input
                    id="input-dia-fechamento"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Dia (1-31)"
                    value={novoDiaFechamento}
                    onChange={(e) => setNovoDiaFechamento(e.target.value)}
                    className="input-limite"
                  />
                  <button type="button" className="btn-primary" onClick={salvarFechamentoCartao}>
                    Salvar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {entradas.length > 0 && (
        <div className="panel bloco-entradas">
          <span className="label">Entradas do Mês — {entradas.length} registro{entradas.length > 1 ? 's' : ''}</span>
          <ul className="lista-entradas">
            {entradas.map((e, i) => {
              const paginaDoItem = Math.floor(i / POR_PAGINA_ENTRADAS) + 1;
              return (
                <li
                  key={e.id}
                  className={`item-entrada ${paginaDoItem !== paginaEntradas ? 'oculto-paginacao' : ''}`}
                >
                  <div className="item-info">
                    <strong title={e.origem}>{e.origem}</strong>
                    <span className="label">
                      {e.descricao ? `${e.descricao} · ` : ''}{formatarData(e.data)}
                    </span>
                  </div>
                  <span className="item-valor-entrada">+{formatarMoeda(e.valor)}</span>
                  <button
                    className="botao-icone"
                    onClick={() => {
                      setEntradaEditando(e);
                      setModalEntradaAberto(true);
                    }}
                    aria-label={`Editar entrada ${e.origem}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="botao-icone"
                    onClick={() => excluirEntrada(e.id)}
                    aria-label={`Excluir entrada ${e.origem}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>

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
      )}

      <div className="panel bloco-grafico">
        <span className="label">Gastos por Categoria</span>
        <div style={{ width: '100%', height: 260, marginTop: 16 }}>
          {ehMobile ? (
            dadosComGasto.length === 0 ? (
              <p className="label" style={{ padding: '90px 0', textAlign: 'center' }}>
                Nenhum gasto registrado neste mês ainda.
              </p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={dadosComGasto}
                    dataKey="gasto"
                    nameKey="nome"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {dadosComGasto.map((entrada) => (
                      <Cell key={entrada.nome} fill={entrada.cor} stroke="var(--bg)" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                    }}
                    formatter={(valor) => formatarMoeda(valor)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )
          ) : (
            <ResponsiveContainer>
              <BarChart data={dadosGrafico} barGap={4}>
                <XAxis
                  dataKey="nome"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--panel-alt)' }}
                  contentStyle={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                  }}
                  formatter={(valor) => formatarMoeda(valor)}
                />
                <Bar dataKey="gasto" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="limite" fill="var(--chart-neutral)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="panel bloco-despesas">
        <div className="bloco-despesas-header">
          <span className="label">Últimas Despesas</span>
          <Link to="/despesas" className="label link-destacado">
            Ver Todas →
          </Link>
        </div>
        <ul className="lista-despesas">
          {despesas.map((d) => (
            <li key={d.id} className="item-despesa">
              <span className="item-icone" style={{ color: d.categoria_cor }}>
                <IconeCategoria nome={d.categoria_icone} />
              </span>
              <div className="item-info">
                <strong title={d.descricao}>{d.descricao}</strong>
                <span className="label">{d.categoria_nome} · {formatarData(d.data)}</span>
              </div>
              <span className="item-valor">-{formatarMoeda(d.valor)}</span>
              <button className="botao-icone" onClick={() => abrirEdicao(d)} aria-label="Editar despesa">
                <Pencil size={14} />
              </button>
              <button className="botao-icone botao-excluir-despesa" onClick={() => excluirDespesa(d)} aria-label={`Excluir despesa ${d.descricao}`}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ModalEntrada
        aberto={modalEntradaAberto}
        entradaEditando={entradaEditando}
        onFechar={() => {
          setModalEntradaAberto(false);
          setEntradaEditando(null);
        }}
        onSalvo={entradaSalva}
      />
    </div>
  );
}
