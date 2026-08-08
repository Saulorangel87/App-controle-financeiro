import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Trash2, Plus } from 'lucide-react';
import api from '../services/api';
import { formatarMoeda } from '../utils/formatters';
import './DespesasRecorrentes.css';

const VAZIO = { descricao: '', valor: '', dia_vencimento: '', observacao: '', parcelada: false, parcela_total: '' };

export default function DespesasRecorrentes() {
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const res = await api.get('/recorrentes');
    setItens(res.data.itens);
    setTotal(res.data.total);
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
    // Número de parcelas não é editável (ver nota no backend) — o campo
    // parcelada/parcela_total só existe no formulário de criação.
    setForm({
      descricao: item.descricao,
      valor: item.valor != null ? String(item.valor) : '',
      dia_vencimento: item.dia_vencimento != null ? String(item.dia_vencimento) : '',
      observacao: item.observacao || '',
      parcelada: false,
      parcela_total: '',
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
    if (form.parcelada && (!form.parcela_total || Number(form.parcela_total) < 2)) {
      setErro('Informe em quantas parcelas (mínimo 2).');
      return;
    }
    if (form.parcelada && (!form.valor || Number(form.valor) <= 0)) {
      setErro('Informe o valor de cada parcela.');
      return;
    }

    const payload = {
      descricao: form.descricao.trim(),
      valor: form.valor ? Number(form.valor) : null,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
      observacao: form.observacao.trim() || null,
      ...(!editandoId && form.parcelada ? { parcela_total: Number(form.parcela_total) } : {}),
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
    await api.patch(`/recorrentes/${item.id}/pago`, { pago: !item.pago });
    carregar();
  }

  if (carregando) return <p className="label">Carregando...</p>;

  return (
    <div className="panel recorrentes-panel">
      <div className="recorrentes-header">
        <div>
          <span className="label">Despesas Recorrentes — contas fixas e prestações do mês</span>
          <strong className="total-recorrentes">{formatarMoeda(total)}</strong>
        </div>
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
              placeholder="ex: Conta de luz, Geladeira"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="linha-campos">
            <div className="campo">
              <label className="label" htmlFor="rec-valor">
                {form.parcelada ? 'Valor de cada parcela (R$)' : 'Valor aproximado (R$)'}
              </label>
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

          {!editandoId && (
            <div className="campo campo-parcelamento">
              <label className="checkbox-linha">
                <input
                  type="checkbox"
                  checked={form.parcelada}
                  onChange={(e) => setForm((f) => ({ ...f, parcelada: e.target.checked }))}
                />
                É uma compra parcelada (ex: geladeira em 12x)
              </label>
              {form.parcelada && (
                <div className="campo" style={{ marginTop: 10 }}>
                  <label className="label" htmlFor="rec-parcelas">Total de parcelas</label>
                  <input
                    id="rec-parcelas"
                    type="number"
                    min="2"
                    max="999"
                    placeholder="ex: 12"
                    value={form.parcela_total}
                    onChange={(e) => setForm((f) => ({ ...f, parcela_total: e.target.value }))}
                  />
                  <span className="contador-caracteres">
                    Começa em 1/{form.parcela_total || '?'} este mês e avança sozinha todo mês.
                  </span>
                </div>
              )}
            </div>
          )}

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
              <strong>
                {item.descricao}
                {item.parcela_total && (
                  <span className={`badge-parcela ${item.parcela_concluida ? 'concluida' : ''}`}>
                    {item.parcela_concluida ? 'quitada' : `${item.parcela_atual}/${item.parcela_total}`}
                  </span>
                )}
              </strong>
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
