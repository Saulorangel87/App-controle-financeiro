import { useEffect, useState } from 'react';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { formatarMoeda } from '../utils/formatters';
import './Categorias.css';

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [novoLimite, setNovoLimite] = useState('');

  async function carregar() {
    const res = await api.get('/categorias');
    setCategorias(res.data);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirEdicao(cat) {
    setEditandoId(cat.id);
    setNovoLimite(String(cat.limite));
  }

  async function salvarLimite(id) {
    await api.put(`/categorias/${id}`, { limite: Number(novoLimite) });
    setEditandoId(null);
    carregar();
  }

  if (carregando) return <p className="label">Carregando...</p>;

  return (
    <div className="grid-categorias">
      {categorias.map((c) => {
        const percentual = Math.min(c.percentual, 100);
        const corBarra = c.status === 'EXCEDIDO' ? 'var(--danger)' : c.cor;

        return (
          <div className="panel card-categoria" key={c.id}>
            <div className="card-categoria-header">
              <span className="card-categoria-nome" style={{ color: c.cor }}>
                <IconeCategoria nome={c.icone} />
                {c.nome}
              </span>
              <span className={`badge ${c.status === 'EXCEDIDO' ? 'badge-excedido' : 'badge-ok'}`}>
                {c.status}
              </span>
            </div>

            <div className="linha-valor">
              <span className="label">Gasto</span>
              <strong style={{ color: c.status === 'EXCEDIDO' ? 'var(--danger)' : 'var(--text-primary)' }}>
                {formatarMoeda(c.gasto)}
              </strong>
            </div>
            <div className="linha-valor">
              <span className="label">Limite</span>
              <span className="label" style={{ color: 'var(--text-secondary)' }}>{formatarMoeda(c.limite)}</span>
            </div>
            <div className="linha-valor">
              <span className="label">Disponível</span>
              <strong style={{ color: c.disponivel < 0 ? 'var(--danger)' : 'var(--accent)' }}>
                {formatarMoeda(c.disponivel)}
              </strong>
            </div>

            <div className="barra-fundo" style={{ marginTop: 10 }}>
              <div className="barra-preenchida" style={{ width: `${percentual}%`, background: corBarra }} />
            </div>
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <span className="label">{c.percentual}%</span>
            </div>

            {editandoId === c.id ? (
              <div className="edicao-limite">
                <input
                  type="number"
                  value={novoLimite}
                  onChange={(e) => setNovoLimite(e.target.value)}
                  className="input-limite"
                  autoFocus
                />
                <button className="btn-primary" onClick={() => salvarLimite(c.id)}>Salvar</button>
              </div>
            ) : (
              <button className="botao-editar" onClick={() => abrirEdicao(c)}>
                Editar Limite
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
