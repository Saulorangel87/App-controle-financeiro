import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Trash2, Plus } from 'lucide-react';
import api from '../services/api';
import { formatarMoeda } from '../utils/formatters';
import './DespesasRecorrentes.css';

const VAZIO = { descricao: '', valor: '', dia_vencimento: '', observacao: '' };

export default function DespesasRecorrentes() {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const res = await api.get('/recorrentes');
    setItens(res.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(VAZIO);
    setErro('');
    setFormAberto(true);
  }

  function abrirEdicao(item) {
    setEditandoId(item.id);
    setForm({
      descricao: item.descricao,
      valor: item.valor != null ? String(item.valor) : '',
      dia_vencimento: item.dia_vencimento != null ? String(item.dia_vencimento) : '',
      observacao: item.observacao || '',
    });
    setErro('');
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditandoId(null);
    setForm(VAZIO);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');

    if (!form.descricao.trim()) {
      setErro('Preencha a descrição (ex: Conta de luz).');
      return;
    }

    const payload = {
      descricao: form.descricao.trim(),
      valor: form.valor ? Number(form.valor) : null,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
      observacao: form.observacao.trim() || null,
    };

    setEnviando(true);
    try {
      if (editandoId) {
        await api.put(`/recorrentes/${editandoId}`, payload);
      } else {
        await api.post('/recorrentes', payload);
      }
      fecharForm();
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(id) {
    await api.delete(`/recorrentes/${id}`);
    carregar();
  }

  async function alternarPago(item) {
    const res = await api.patch(`/recorrentes/${item.id}/pago`, { pago: !item.pago });
    setItens((atual) => atual.map((i) => (i.id === item.id ? res.data : i)));
  }

  if (carregando) return <p className="label">Carregando...</p>;

  return (
    <div className="panel recorrentes-panel">
      <div className="recorrentes-header">
        <span className="label">Despesas Recorrentes — contas fixas do dia a dia</span>
        {!formAberto && (
          <button className="btn-primary botao-nova-recorrente" onClick={abrirNovo}>
            <Plus size={14} /> Nova
          </button>
        )}
      </div>

      {formAberto && (
        <form onSubmit={salvar} className="form-recorrente">
          <div className="campo">
            <label className="label" htmlFor="rec-descricao">Descrição</label>
            <input
              id="rec-descricao"
              type="text"
              placeholder="ex: Conta de luz"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="linha-campos">
            <div className="campo">
              <label className="label" htmlFor="rec-valor">Valor aproximado (R$)</label>
              <input
                id="rec-valor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div className="campo">
              <label className="label" htmlFor="rec-dia">Dia de vencimento</label>
              <input
                id="rec-dia"
                type="number"
                min="1"
                max="31"
                placeholder="ex: 10"
                value={form.dia_vencimento}
                onChange={(e) => setForm((f) => ({ ...f, dia_vencimento: e.target.value }))}
              />
            </div>
          </div>
          <div className="campo">
            <label className="label" htmlFor="rec-obs">Observação (opcional)</label>
            <input
              id="rec-obs"
              type="text"
              placeholder="ex: débito automático no cartão"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
            />
          </div>
          {erro && <p className="erro-form" role="alert">{erro}</p>}
          <div className="acoes-form-recorrente">
            <button type="button" className="botao-editar" onClick={fecharForm}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}

      <ul className="lista-recorrentes">
        {itens.map((item) => (
          <li key={item.id} className={`item-recorrente ${item.pago ? 'pago' : ''}`}>
            <button
              className={`checkbox-pago ${item.pago ? 'marcado' : ''}`}
              onClick={() => alternarPago(item)}
              aria-pressed={item.pago}
              aria-label={item.pago ? `Marcar ${item.descricao} como não paga` : `Marcar ${item.descricao} como paga este mês`}
            >
              {item.pago && <Check size={12} />}
            </button>

            <div className="item-info">
              <strong>{item.descricao}</strong>
              <span className="label">
                {item.dia_vencimento ? `vence dia ${item.dia_vencimento}` : 'sem dia fixo'}
                {item.observacao ? ` · ${item.observacao}` : ''}
              </span>
            </div>

            {item.valor != null && (
              <span className="item-valor-recorrente">{formatarMoeda(item.valor)}</span>
            )}

            <button className="botao-icone" onClick={() => abrirEdicao(item)} aria-label={`Editar ${item.descricao}`}>
              <Pencil size={14} />
            </button>
            <button className="botao-icone botao-excluir-recorrente" onClick={() => excluir(item.id)} aria-label={`Excluir ${item.descricao}`}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}

        {itens.length === 0 && !formAberto && (
          <p className="label" style={{ padding: '24px 0' }}>
            Nenhuma despesa recorrente cadastrada ainda. Cadastre suas contas fixas (luz, água, internet...) pra não esquecer delas.
          </p>
        )}
      </ul>
    </div>
  );
}
