import { useEffect, useState } from 'react';
import api from '../services/api';
import './ModalNovaDespesa.css';

const LIMITE_DESCRICAO = 80;

function hoje() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function ModalNovaDespesa({ aberto, despesaEditando, onFechar, onSalvo }) {
  const editando = Boolean(despesaEditando);

  const [categorias, setCategorias] = useState([]);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [data, setData] = useState(hoje());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!aberto) return;

    api.get('/categorias').then((res) => {
      setCategorias(res.data);
      if (!editando) {
        setCategoriaId((atual) => atual || res.data[0]?.id || '');
      }
    });

    if (despesaEditando) {
      setDescricao(despesaEditando.descricao);
      setValor(String(despesaEditando.valor));
      setCategoriaId(despesaEditando.categoria_id);
      setData(despesaEditando.data);
    } else {
      setDescricao('');
      setValor('');
      setData(hoje());
    }
    setErro('');
  }, [aberto, despesaEditando]);

  if (!aberto) return null;

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (!descricao.trim() || !valor || !categoriaId || !data) {
      setErro('Preencha todos os campos.');
      return;
    }

    setEnviando(true);
    try {
      const payload = {
        descricao: descricao.trim(),
        valor: Number(valor),
        categoria_id: Number(categoriaId),
        data,
      };

      if (editando) {
        await api.put(`/despesas/${despesaEditando.id}`, payload);
      } else {
        await api.post('/despesas', payload);
      }

      onSalvo();
      onFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="label">{editando ? 'Editar Despesa' : 'Nova Despesa'}</span>
          <button className="modal-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={enviar} className="modal-form">
          <div className="campo">
            <span className="label">Descrição</span>
            <input
              type="text"
              placeholder="ex: Supermercado"
              value={descricao}
              maxLength={LIMITE_DESCRICAO}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <span className="contador-caracteres">{descricao.length}/{LIMITE_DESCRICAO}</span>
          </div>

          <div className="campo">
            <span className="label">Valor (R$)</span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="campo">
            <span className="label">Categoria</span>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="campo">
            <span className="label">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          {erro && <p className="erro-form">{erro}</p>}

          <button type="submit" className="btn-primary" disabled={enviando} style={{ width: '100%', padding: 14 }}>
            {enviando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Adicionar Despesa'}
          </button>
        </form>
      </div>
    </div>
  );
}
