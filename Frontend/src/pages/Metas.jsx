import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { formatarMoeda } from '../utils/formatters';
import './Metas.css';

const LIMITE_NOME = 60;

const STATUS_LABEL = {
  CONCLUIDA: 'Concluída',
  EM_ANDAMENTO: 'Em andamento',
  NAO_ATINGIDA: 'Não atingida',
};

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

export default function Metas() {
  const [metas, setMetas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [valorAlvo, setValorAlvo] = useState('');
  const [mesInicio, setMesInicio] = useState(mesAtual());
  const [mesFim, setMesFim] = useState(mesAtual());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    const res = await api.get('/metas');
    setMetas(res.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirForm() {
    setNome('');
    setValorAlvo('');
    setMesInicio(mesAtual());
    setMesFim(mesAtual());
    setErro('');
    setFormAberto(true);
  }

  async function criar(e) {
    e.preventDefault();
    setErro('');

    if (!nome.trim() || !valorAlvo || !mesInicio || !mesFim) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (mesFim < mesInicio) {
      setErro('O mês final não pode ser anterior ao mês inicial.');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/metas', {
        nome: nome.trim(),
        valor_alvo: Number(valorAlvo),
        mes_inicio: mesInicio,
        mes_fim: mesFim,
      });
      setFormAberto(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar a meta.');
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(id) {
    await api.delete(`/metas/${id}`);
    carregar();
  }

  if (carregando) return <p className="label">Carregando...</p>;

  return (
    <div className="metas">
      <div className="metas-header">
        <span className="label">Metas de Economia</span>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (formAberto ? setFormAberto(false) : abrirForm())}
        >
          {formAberto ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Nova Meta</>}
        </button>
      </div>

      {formAberto && (
        <form className="panel form-meta" onSubmit={criar}>
          <div className="campo">
            <label className="label" htmlFor="meta-nome">Nome</label>
            <input
              id="meta-nome"
              type="text"
              placeholder="ex: Viagem de fim de ano"
              value={nome}
              maxLength={LIMITE_NOME}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="label" htmlFor="meta-valor">Valor alvo (R$)</label>
            <input
              id="meta-valor"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={valorAlvo}
              onChange={(e) => setValorAlvo(e.target.value)}
            />
          </div>

          <div className="linha-periodo-meta">
            <div className="campo">
              <label className="label" htmlFor="meta-mes-inicio">Mês inicial</label>
              <input
                id="meta-mes-inicio"
                type="month"
                value={mesInicio}
                onChange={(e) => setMesInicio(e.target.value)}
              />
            </div>
            <div className="campo">
              <label className="label" htmlFor="meta-mes-fim">Mês final</label>
              <input
                id="meta-mes-fim"
                type="month"
                value={mesFim}
                min={mesInicio}
                onChange={(e) => setMesFim(e.target.value)}
              />
            </div>
          </div>

          {erro && <p className="erro-form" role="alert">{erro}</p>}

          <button type="submit" className="btn-primary" disabled={enviando} style={{ width: '100%', padding: 14 }}>
            {enviando ? 'Salvando...' : 'Criar Meta'}
          </button>
        </form>
      )}

      <div className="grid-metas">
        {metas.map((meta) => {
          const corBarra = meta.status === 'CONCLUIDA'
            ? 'var(--accent)'
            : meta.status === 'NAO_ATINGIDA'
              ? 'var(--danger)'
              : 'var(--ok)';

          return (
            <div className="panel card-meta" key={meta.id}>
              <div className="card-meta-header">
                <strong>{meta.nome}</strong>
                <button
                  type="button"
                  className="botao-icone"
                  onClick={() => excluir(meta.id)}
                  aria-label={`Excluir meta ${meta.nome}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <span className="label">{meta.mes_inicio} até {meta.mes_fim}</span>

              <div className="linha-valor" style={{ marginTop: 10 }}>
                <span className="label">Guardado</span>
                <strong style={{ color: meta.progresso < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {formatarMoeda(meta.progresso)}
                </strong>
              </div>
              <div className="linha-valor">
                <span className="label">Alvo</span>
                <span className="label" style={{ color: 'var(--text-secondary)' }}>
                  {formatarMoeda(meta.valor_alvo)}
                </span>
              </div>

              <div className="barra-fundo-meta">
                <div className="barra-preenchida-meta" style={{ width: `${meta.percentual}%`, background: corBarra }} />
              </div>
              <div className="card-meta-rodape">
                <span className="label">{meta.percentual}%</span>
                <span className={`badge ${meta.status === 'CONCLUIDA' ? 'badge-ok' : meta.status === 'NAO_ATINGIDA' ? 'badge-excedido' : 'badge-andamento'}`}>
                  {STATUS_LABEL[meta.status]}
                </span>
              </div>
            </div>
          );
        })}

        {metas.length === 0 && !formAberto && (
          <p className="label">Nenhuma meta cadastrada ainda.</p>
        )}
      </div>
    </div>
  );
}
