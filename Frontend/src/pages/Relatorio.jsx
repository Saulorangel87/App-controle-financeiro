import { useEffect, useState } from 'react';
import { Printer, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Relatorio.css';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const POR_PAGINA = 20;
const POR_PAGINA_ENTRADAS = 10;

function rotuloMes(mesISO) {
  const [ano, mes] = mesISO.split('-').map(Number);
  return `${NOMES_MES[mes - 1]} ${ano}`;
}

export default function Relatorio() {
  const [meses, setMeses] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [paginaEntradas, setPaginaEntradas] = useState(1);

  useEffect(() => {
    async function carregarMeses() {
      const [resMeses, resCategorias] = await Promise.all([
        api.get('/relatorio/meses'),
        api.get('/categorias'),
      ]);
      setMeses(resMeses.data);
      setCategorias(resCategorias.data);
      setMesSelecionado(resMeses.data[0]);
    }
    carregarMeses();
  }, []);

  useEffect(() => {
    if (!mesSelecionado) return;
    setCarregando(true);
    api.get('/relatorio', {
      params: {
        mes: mesSelecionado,
        categoria_id: categoriaSelecionada || undefined,
      },
    }).then((res) => {
      setDados(res.data);
      setCarregando(false);
      setPagina(1); // troca de mês sempre volta pra primeira página
      setPaginaEntradas(1);
    });
  }, [mesSelecionado, categoriaSelecionada]);

  if (!mesSelecionado || carregando || !dados) return <p className="label">Carregando...</p>;

  const aumentou = dados.variacaoAbsoluta > 0;
  const corVariacao = aumentou ? 'var(--danger)' : 'var(--accent)';
  const setaVariacao = aumentou ? '↑' : '↓';
  const saldoPeriodo = (dados.totalEntradas || 0) - dados.totalAtual;
  const corSaldo = saldoPeriodo >= 0 ? 'var(--ok)' : 'var(--danger)';
  const nomeCategoriaSelecionada = categorias.find((c) => String(c.id) === categoriaSelecionada)?.nome;
  const totalPaginas = Math.max(1, Math.ceil(dados.despesas.length / POR_PAGINA));
  const totalPaginasEntradas = Math.max(1, Math.ceil((dados.entradas?.length || 0) / POR_PAGINA_ENTRADAS));

  async function exportarExcel() {
    const moduloXLSX = await import('xlsx-js-style');
    const XLSX = moduloXLSX.default || moduloXLSX;
    const totalDespesas = Number(dados.totalAtual || 0);
    const totalEntradas = Number(dados.totalEntradas || 0);
    const saldo = totalEntradas - totalDespesas;
    const linhas = [
      ['RELATÓRIO FINANCEIRO', rotuloMes(mesSelecionado)],
      ['Gerado em', new Date().toLocaleDateString('pt-BR')],
      [],
      ['RESUMO DO PERÍODO'],
      ['Total de despesas', totalDespesas],
      ['Total de entradas', totalEntradas],
      ['Saldo do período', saldo],
      ['Total de lançamentos', dados.despesas.length + (dados.entradas || []).length],
      [],
      ['LANÇAMENTOS'],
      ['Tipo', 'Data', 'Descrição', 'Categoria / Origem', 'Valor (R$)'],
      ...dados.despesas.map((d) => ['Despesa', d.data, d.descricao, d.categoria_nome, -Number(d.valor || 0)]),
      ...(dados.entradas || []).map((e) => ['Entrada', e.data, e.descricao || '', e.origem, Number(e.valor || 0)]),
    ];
    const planilha = XLSX.utils.aoa_to_sheet(linhas);
    const corCabecalho = '1F2937';
    const corAcento = 'C6FF2E';
    const corEntrada = 'E8F5F0';
    const corDespesa = 'FFF1F2';
    const corNeutra = 'F3F4F6';
    const estiloTitulo = { font: { bold: true, color: 'FFFFFF', sz: 16 }, fill: { fgColor: { rgb: corCabecalho } }, alignment: { vertical: 'center' } };
    const estiloSecao = { font: { bold: true, color: '111827' }, fill: { fgColor: { rgb: corAcento } } };
    const estiloColunas = { font: { bold: true, color: 'FFFFFF' }, fill: { fgColor: { rgb: corCabecalho } }, alignment: { horizontal: 'center' } };
    const estiloValor = { numFmt: 'R$ #,##0.00;[Red]-R$ #,##0.00' };

    planilha['A1'].s = estiloTitulo;
    planilha['B1'].s = estiloTitulo;
    planilha['A2'].s = { font: { italic: true, color: '6B7280' } };
    planilha['B2'].s = { font: { italic: true, color: '6B7280' } };
    ['A4', 'A10'].forEach((celula) => { planilha[celula].s = estiloSecao; });
    for (const coluna of ['A', 'B', 'C', 'D', 'E']) planilha[`${coluna}11`].s = estiloColunas;
    for (const linha of [5, 6, 7]) {
      planilha[`A${linha}`].s = { font: { bold: true } };
      planilha[`B${linha}`].s = { ...estiloValor, font: { bold: true } };
    }
    planilha.B5.s.fill = { fgColor: { rgb: corDespesa } };
    planilha.B6.s.fill = { fgColor: { rgb: corEntrada } };
    planilha.B7.s.fill = { fgColor: { rgb: saldo >= 0 ? corEntrada : corDespesa } };
    planilha.B8.s = { font: { bold: true }, fill: { fgColor: { rgb: corNeutra } }, alignment: { horizontal: 'center' } };
    for (let linha = 12; linha <= linhas.length; linha += 1) {
      const tipo = planilha[`A${linha}`]?.v;
      planilha[`E${linha}`].s = estiloValor;
      if (tipo === 'Entrada') planilha[`A${linha}`].s = { fill: { fgColor: { rgb: corEntrada } }, font: { color: '0F766E', bold: true } };
      if (tipo === 'Despesa') planilha[`A${linha}`].s = { fill: { fgColor: { rgb: corDespesa } }, font: { color: 'BE123C', bold: true } };
    }
    planilha['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } }];
    planilha['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 32 }, { wch: 24 }, { wch: 17 }];
    planilha['!rows'] = [{ hpt: 28 }];
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, 'Relatório');
    XLSX.writeFile(livro, `relatorio-${mesSelecionado}.xlsx`);
  }

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
          <select
            id="seletor-categoria-relatorio"
            className="seletor-mes seletor-categoria"
            value={categoriaSelecionada}
            aria-label="Filtrar por categoria"
            onChange={(e) => setCategoriaSelecionada(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary botao-imprimir"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Imprimir
          </button>
          <button type="button" className="botao-exportar" onClick={exportarExcel}>
            <Download size={14} /> Excel
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

        <div className="panel card-relatorio">
          <span className="label">Entradas em {rotuloMes(mesSelecionado)}</span>
          <strong className="valor" style={{ color: 'var(--ok)' }}>
            +{formatarMoeda(dados.totalEntradas || 0)}
          </strong>
        </div>

        <div className="panel card-relatorio">
          <span className="label">Saldo do período</span>
          <strong className="valor" style={{ color: corSaldo }}>
            {saldoPeriodo >= 0 ? '+' : ''}{formatarMoeda(saldoPeriodo)}
          </strong>
        </div>
      </div>

      <div className="panel bloco-fechamento-mensal">
        <div>
          <span className="label">Fechamento de {rotuloMes(mesSelecionado)}</span>
          <strong className="titulo-fechamento">{dados.categoriasExcedidas?.length || 0} categorias acima do limite</strong>
        </div>
        {dados.categoriasExcedidas?.length > 0 ? (
          <ul className="lista-fechamento">
            {dados.categoriasExcedidas.map((categoria) => (
              <li key={categoria.id}>
                <span>{categoria.nome}</span>
                <span className="item-valor">{formatarMoeda(categoria.gasto)} / {formatarMoeda(categoria.limite)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="label">Nenhuma categoria excedeu o limite neste período.</span>
        )}
      </div>

      <div className="panel bloco-despesas-mes">
        <span className="label">
          Despesas de {rotuloMes(mesSelecionado)}{nomeCategoriaSelecionada ? ` · ${nomeCategoriaSelecionada}` : ''} — {dados.despesas.length} registros
        </span>
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

      {/* Entradas ficam num bloco à parte — são dinheiro que entrou, não
          dinheiro gasto, então não fazem sentido misturadas com despesas. */}
      <div className="panel bloco-despesas-mes">
        <span className="label">
          Entradas de {rotuloMes(mesSelecionado)} — {(dados.entradas || []).length} registros
        </span>
        <ul className="lista-despesas-mes">
          {(dados.entradas || []).map((e, i) => {
            const paginaDoItem = Math.floor(i / POR_PAGINA_ENTRADAS) + 1;
            return (
              <li
                key={e.id}
                className={`item-despesa-mes ${paginaDoItem !== paginaEntradas ? 'oculto-paginacao' : ''}`}
              >
                <div className="item-info">
                  <strong>{e.origem}</strong>
                  <span className="label">{e.descricao ? `${e.descricao} · ` : ''}{formatarData(e.data)}</span>
                </div>
                <span className="item-valor" style={{ color: 'var(--ok)' }}>+{formatarMoeda(e.valor)}</span>
              </li>
            );
          })}
          {(dados.entradas || []).length === 0 && (
            <p className="label" style={{ padding: '20px 0' }}>Nenhuma entrada registrada nesse mês.</p>
          )}
        </ul>

        {totalPaginasEntradas > 1 && (
          <div className="paginacao ocultar-impressao">
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
