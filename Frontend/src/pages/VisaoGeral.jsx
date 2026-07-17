import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { useDespesaModal } from '../contexts/DespesaModalContext';
import { formatarMoeda, formatarData } from '../utils/formatters';
import { useRecarregarAoVirarMes } from '../utils/useRecarregarAoVirarMes';
import './VisaoGeral.css';

export default function VisaoGeral() {
  const [resumo, setResumo] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoOrcamento, setEditandoOrcamento] = useState(false);
  const [novoOrcamento, setNovoOrcamento] = useState('');
  const { abrirEdicao } = useDespesaModal();

  async function carregarResumo() {
    const res = await api.get('/resumo');
    setResumo(res.data);
  }

  const carregarTudo = useCallback(async () => {
    const [resResumo, resCategorias, resDespesas] = await Promise.all([
      api.get('/resumo'),
      api.get('/categorias'),
      api.get('/despesas'),
    ]);
    setResumo(resResumo.data);
    setCategorias(resCategorias.data);
    setDespesas(resDespesas.data.slice(0, 4));
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Se o mês virar com a aba aberta, recarrega tudo — o dashboard não fica
  // "preso" mostrando os totais do mês que já passou.
  useRecarregarAoVirarMes(carregarTudo);

  function abrirEdicaoOrcamento() {
    setNovoOrcamento(String(resumo.orcamentoTotal));
    setEditandoOrcamento(true);
  }

  async function salvarOrcamento() {
    await api.put('/orcamento', { valor: Number(novoOrcamento) });
    setEditandoOrcamento(false);
    carregarResumo();
  }

  if (carregando) return <p className="label">Carregando...</p>;

  const dadosGrafico = resumo.gastoPorCategoria.map((c) => ({
    nome: c.nome,
    gasto: c.gasto,
    limite: c.limite,
  }));

  const percentual = Math.min(resumo.percentualUtilizado, 100);
  const corBarra =
    resumo.percentualUtilizado >= 100
      ? 'var(--danger)'
      : resumo.percentualUtilizado >= 90
      ? 'var(--warning)'
      : 'var(--accent)';

  return (
    <div className="visao-geral">
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
              <button className="botao-editar-inline" onClick={abrirEdicaoOrcamento} aria-label="Editar orçamento total">
                editar
              </button>
            )}
          </div>
          {editandoOrcamento ? (
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
          ) : (
            <strong className="valor" style={{ color: 'var(--ok)' }}>
              {formatarMoeda(resumo.orcamentoTotal)}
            </strong>
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
      </div>

      <div className="panel bloco-grafico">
        <span className="label">Gastos por Categoria</span>
        <div style={{ width: '100%', height: 260, marginTop: 16 }}>
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
              <Bar dataKey="limite" fill="#2a2a2a" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel bloco-despesas">
        <div className="bloco-despesas-header">
          <span className="label">Últimas Despesas</span>
          <Link to="/despesas" className="label" style={{ color: 'var(--accent)' }}>
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
