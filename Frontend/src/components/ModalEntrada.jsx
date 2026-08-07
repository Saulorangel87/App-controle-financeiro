import { useEffect, useState } from 'react';
import api from '../services/api';
import './ModalEntrada.css';

const LIMITE_DESCRICAO = 80;
const LIMITE_ORIGEM = 40;

function hoje() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function ModalEntrada({ aberto, onFechar, onSalvo }) {
  const [origem, setOrigem] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hoje());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const dataEhFutura = data > hoje();

  useEffect(() => {
    if (!aberto) return;
    setOrigem('');
    setDescricao('');
    setValor('');
    setData(hoje());
    setErro('');
  }, [aberto]);

  if (!aberto) return null;

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (!origem.trim() || !valor || Number(valor) <= 0 || !data) {
      setErro('Preencha origem, valor e data.');
      return;
    }
    if (data > hoje()) {
      setErro('Não é possível registrar uma entrada com data futura.');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/entradas', {
        origem: origem.trim(),
        descricao: descricao.trim() || undefined,
        valor: Number(valor),
        data,
      });
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
          <span className="label">Adicionar Valor ao Orçamento</span>
          <button className="modal-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={enviar} className="modal-form">
          <div className="campo">
            <label className="label" htmlFor="campo-origem-entrada">Origem</label>
            <input
              id="campo-origem-entrada"
              type="text"
              placeholder="ex: Freelance, Reembolso, 13º salário"
              value={origem}
              maxLength={LIMITE_ORIGEM}
              onChange={(e) => setOrigem(e.target.value)}
              autoFocus
            />
            <span className="contador-caracteres">{origem.length}/{LIMITE_ORIGEM}</span>
          </div>

          <div className="campo">
            <label className="label" htmlFor="campo-descricao-entrada">Descrição (opcional)</label>
            <input
              id="campo-descricao-entrada"
              type="text"
              placeholder="ex: Projeto do site do meu irmão"
              value={descricao}
              maxLength={LIMITE_DESCRICAO}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <span className="contador-caracteres">{descricao.length}/{LIMITE_DESCRICAO}</span>
          </div>

          <div className="campo">
            <label className="label" htmlFor="campo-valor-entrada">Valor (R$)</label>
            <input
              id="campo-valor-entrada"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="label" htmlFor="campo-data-entrada">Data</label>
            <input
              id="campo-data-entrada"
              type="date"
              value={data}
              max={hoje()}
              aria-invalid={dataEhFutura}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          {erro && <p className="erro-form" role="alert">{erro}</p>}

          <button type="submit" className="btn-primary" disabled={enviando || dataEhFutura} style={{ width: '100%', padding: 14 }}>
            {enviando ? 'Salvando...' : 'Adicionar ao Orçamento'}
          </button>
        </form>
      </div>
    </div>
  );
}
