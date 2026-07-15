import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { useDespesaModal } from '../contexts/DespesaModalContext';
import { formatarMoeda, formatarData } from '../utils/formatters';
import './Despesas.css';

export default function Despesas() {
  const [despesas, setDespesas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const { abrirEdicao } = useDespesaModal();

  async function carregar() {
    const res = await api.get('/despesas');
    setDespesas(res.data);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function excluir(id) {
    await api.delete(`/despesas/${id}`);
    carregar();
  }

  if (carregando) return <p className="label">Carregando...</p>;

  const total = despesas.reduce((soma, d) => soma + d.valor, 0);

  return (
    <div className="panel despesas-panel">
      <div className="despesas-header">
        <span className="label">Todas as Despesas — {despesas.length} registros</span>
        <span className="label">
          Total: <strong style={{ color: 'var(--text-primary)' }}>{formatarMoeda(total)}</strong>
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
    </div>
  );
}
