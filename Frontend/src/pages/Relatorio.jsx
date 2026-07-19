import { useEffect, useState } from 'react';
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Relatorio.css';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const POR_PAGINA = 20;

function rotuloMes(mesISO) {
  const [ano, mes] = mesISO.split('-').map(Number);
  return `${NOMES_MES[mes - 1]} ${ano}`;
}

export default function Relatorio() {
  const [meses, setMeses] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    async function carregarMeses() {
      const res = await api.get('/relatorio/meses');
      setMeses(res.data);
      setMesSelecionado(res.data[0]);
    }
    carregarMeses();
  }, []);

  useEffect(() => {
    if (!mesSelecionado) return;
    setCarregando(true);
    api.get('/relatorio', { params: { mes: mesSelecionado } }).then((res) => {
      setDados(res.data);
      setCarregando(false);
      setPagina(1); // troca de mês sempre volta pra primeira página
    });
  }, [mesSelecionado]);

  if (!mesSelecionado || carregando || !dados) return <p className="label">Carregando...</p>;

  const aumentou = dados.variacaoAbsoluta > 0;
  const corVariacao = aumentou ? 'var(--danger)' : 'var(--accent)';
  const setaVariacao = aumentou ? '↑' : '↓';
  const totalPaginas = Math.max(1, Math.ceil(dados.despesas.length / POR_PAGINA));

  return (
    <div className="relatorio">
      <div className="relatorio-header">
        <div>
          <label className="label" htmlFor="seletor-mes-relatorio">Relatório Mensal</label>
          <strong className="somente-impressao" style={{ display: 'block', fontSize: 18 }}>
            {rotuloMes(mesSelecionado)}
          </strong>
          <p className="label somente-impressao">
            Gerado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="relatorio-controles ocultar-impressao">
          <select
            id="seletor-mes-relatorio"
            className="seletor-mes"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
          >
            {meses.map((m) => (
              <option key={m} value={m}>{rotuloMes(m)}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary botao-imprimir"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      <div className="cards-relatorio">
        <div className="panel card-relatorio">
          <span className="label">Total em {rotuloMes(mesSelecionado)}</span>
          <strong className="valor" style={{ color: 'var(--accent)' }}>
            {formatarMoeda(dados.totalAtual)}
          </strong>
        </div>

        <div className="panel card-relatorio">
          <span className="label">Mês Anterior</span>
          <strong className="valor" style={{ color: 'var(--text-secondary)' }}>
            {formatarMoeda(dados.totalAnterior)}
          </strong>
        </div>

        <div className="panel card-relatorio">
          <span className="label">Variação</span>
          <strong className="valor" style={{ color: corVariacao }}>
            {dados.totalAnterior > 0 ? (
              <>{setaVariacao} {Math.abs(dados.variacaoPercentual)}%</>
            ) : (
              formatarMoeda(dados.variacaoAbsoluta)
            )}
          </strong>
        </div>
      </div>

      <div className="panel bloco-despesas-mes">
        <span className="label">Despesas de {rotuloMes(mesSelecionado)} — {dados.despesas.length} registros</span>
        <ul className="lista-despesas-mes">
          {dados.despesas.map((d, i) => {
            const paginaDoItem = Math.floor(i / POR_PAGINA) + 1;
            return (
              <li
                key={d.id}
                className={`item-despesa-mes ${paginaDoItem !== pagina ? 'oculto-paginacao' : ''}`}
              >
                <span className="item-icone" style={{ color: d.categoria_cor }}>
                  <IconeCategoria nome={d.categoria_icone} />
                </span>
                <div className="item-info">
                  <strong>{d.descricao}</strong>
                  <span className="label">{d.categoria_nome} · {formatarData(d.data)}</span>
                </div>
                <span className="item-valor">-{formatarMoeda(d.valor)}</span>
              </li>
            );
          })}
          {dados.despesas.length === 0 && (
            <p className="label" style={{ padding: '20px 0' }}>Nenhuma despesa registrada nesse mês.</p>
          )}
        </ul>

        {totalPaginas > 1 && (
          <div className="paginacao ocultar-impressao">
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
    </div>
  );
}
