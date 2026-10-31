import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../services/api';
import IconeCategoria, { OPCOES_ICONES, OPCOES_CORES } from '../components/IconeCategoria';
import { useMes } from '../contexts/MesContext';
import { formatarMoeda } from '../utils/formatters';
import './Categorias.css';

const FORM_VAZIO = {
  nome: '',
  limite: '',
  icone: 'home',
  cor: '#f97316',
};

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [novoLimite, setNovoLimite] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [categoriaEditandoId, setCategoriaEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { mes } = useMes();

  const carregar = useCallback(async () => {
    const res = await api.get('/categorias', { params: { mes } });
    setCategorias(res.data);
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirEdicao(cat) {
    setEditandoId(cat.id);
    setNovoLimite(String(cat.limite));
  }

  async function salvarLimite(id) {
    await api.put(`/categorias/${id}`, { limite: Number(novoLimite) });
    setEditandoId(null);
    carregar();
  }

  function abrirNovaCategoria() {
    setCategoriaEditandoId(null);
    setForm(FORM_VAZIO);
    setErro('');
    setFormAberto(true);
  }

  function abrirEdicaoCompleta(cat) {
    setCategoriaEditandoId(cat.id);
    setForm({
      nome: cat.nome,
      limite: String(cat.limite),
      icone: cat.icone || 'home',
      cor: cat.cor || '#f97316',
    });
    setErro('');
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setCategoriaEditandoId(null);
    setForm(FORM_VAZIO);
    setErro('');
  }

  async function salvarCategoria(e) {
    e.preventDefault();
    setErro('');

    if (!form.nome.trim() || form.limite === '' || Number(form.limite) < 0) {
      setErro('Informe o nome e um limite válido.');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      limite: Number(form.limite),
      icone: form.icone,
      cor: form.cor,
    };

    setEnviando(true);
    try {
      if (categoriaEditandoId) {
        await api.put(`/categorias/${categoriaEditandoId}`, payload);
      } else {
        await api.post('/categorias', payload);
      }
      fecharForm();
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar a categoria.');
    } finally {
      setEnviando(false);
    }
  }

  async function excluirCategoria(cat) {
    setErro('');
    try {
      await api.delete(`/categorias/${cat.id}`);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível excluir a categoria.');
    }
  }

  if (carregando) return <p className="label">Carregando...</p>;

  return (
    <div className="pagina-categorias">
      <div className="categorias-topo">
        <span className="label">{categorias.length} categorias configuradas</span>
        {!formAberto && (
          <button type="button" className="btn-primary botao-nova-categoria" onClick={abrirNovaCategoria}>
            <Plus size={14} /> Nova Categoria
          </button>
        )}
      </div>

      {erro && !formAberto && <p className="erro-form" role="alert">{erro}</p>}

      {formAberto && (
        <form onSubmit={salvarCategoria} className="panel form-categoria">
          <span className="label">{categoriaEditandoId ? 'Editar Categoria' : 'Nova Categoria'}</span>
          <div className="linha-campos-categoria">
            <div className="campo">
              <label className="label" htmlFor="cat-nome">Nome</label>
              <input
                id="cat-nome"
                type="text"
                maxLength={40}
                placeholder="ex: Pets, Viagens"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="campo">
              <label className="label" htmlFor="cat-limite">Limite mensal (R$)</label>
              <input
                id="cat-limite"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.limite}
                onChange={(e) => setForm((f) => ({ ...f, limite: e.target.value }))}
              />
            </div>
          </div>

          <div className="campo">
            <span className="label">Ícone</span>
            <div className="opcoes-icone">
              {OPCOES_ICONES.map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  className={`botao-opcao-icone ${form.icone === op.valor ? 'selecionado' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, icone: op.valor }))}
                  aria-label={`Ícone ${op.rotulo}`}
                  aria-pressed={form.icone === op.valor}
                  title={op.rotulo}
                >
                  <IconeCategoria nome={op.valor} size={16} />
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <span className="label">Cor</span>
            <div className="opcoes-cor">
              {OPCOES_CORES.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  className={`botao-opcao-cor ${form.cor === cor ? 'selecionado' : ''}`}
                  style={{ background: cor }}
                  onClick={() => setForm((f) => ({ ...f, cor }))}
                  aria-label={`Cor ${cor}`}
                  aria-pressed={form.cor === cor}
                />
              ))}
            </div>
          </div>

          {erro && <p className="erro-form" role="alert">{erro}</p>}

          <div className="acoes-form-categoria">
            <button type="button" className="botao-editar" onClick={fecharForm}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? 'Salvando...' : categoriaEditandoId ? 'Salvar Categoria' : 'Criar Categoria'}
            </button>
          </div>
        </form>
      )}

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
                <div className="card-categoria-acoes">
                  <span className={`badge ${c.status === 'EXCEDIDO' ? 'badge-excedido' : 'badge-ok'}`}>
                    {c.status}
                  </span>
                  <button
                    type="button"
                    className="botao-icone"
                    onClick={() => abrirEdicaoCompleta(c)}
                    aria-label={`Editar categoria ${c.nome}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="botao-icone botao-excluir-categoria"
                    onClick={() => excluirCategoria(c)}
                    aria-label={`Excluir categoria ${c.nome}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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
                  <label className="sr-only" htmlFor={`limite-categoria-${c.id}`}>
                    Novo limite para {c.nome}
                  </label>
                  <input
                    id={`limite-categoria-${c.id}`}
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
    </div>
  );
}
