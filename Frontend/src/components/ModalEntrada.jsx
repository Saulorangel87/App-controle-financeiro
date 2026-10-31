import { useEffect, useState } from 'react';
import api from '../services/api';
import { useMes } from '../contexts/MesContext';
import { dataMaximaDoMes, dataPadraoDoMes } from '../utils/datas';
import { formatarData } from '../utils/formatters';
import './ModalEntrada.css';

const LIMITE_DESCRICAO = 80;
const LIMITE_ORIGEM = 40;

export default function ModalEntrada({ aberto, entradaEditando = null, onFechar, onSalvo }) {
  const editando = Boolean(entradaEditando);
  const { mes } = useMes();
  // Mesma regra do formulário de despesa: entrada nova vem no mês escolhido
  // no seletor; uma de mês futuro sendo editada vai até o fim do mês dela.
  const mesDoLimite = editando && entradaEditando.data?.slice(0, 7) > mes
    ? entradaEditando.data.slice(0, 7)
    : mes;
  const dataMaxima = dataMaximaDoMes(mesDoLimite);
  const [origem, setOrigem] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => dataPadraoDoMes(mes));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const dataEhFutura = data > dataMaxima;

  useEffect(() => {
    if (!aberto) return;
    if (entradaEditando) {
      setOrigem(entradaEditando.origem || '');
      setDescricao(entradaEditando.descricao || '');
      setValor(entradaEditando.valor != null ? String(entradaEditando.valor) : '');
      setData(entradaEditando.data || dataPadraoDoMes(mes));
    } else {
      setOrigem('');
      setDescricao('');
      setValor('');
      setData(dataPadraoDoMes(mes));
    }
    setErro('');
  }, [aberto, entradaEditando, mes]);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  if (!aberto) return null;

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (!origem.trim() || !valor || Number(valor) <= 0 || !data) {
      setErro('Preencha origem, valor e data.');
      return;
    }
    if (data > dataMaxima) {
      setErro(`A data não pode passar de ${formatarData(dataMaxima)}.`);
      return;
    }

    setEnviando(true);
    try {
      const payload = {
        origem: origem.trim(),
        descricao: descricao.trim() || null,
        valor: Number(valor),
        data,
      };
      if (editando) {
        await api.put(`/entradas/${entradaEditando.id}`, payload);
      } else {
        await api.post('/entradas', payload);
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
          <span className="label">{editando ? 'Editar Entrada' : 'Adicionar Valor ao Orçamento'}</span>
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
              placeholder="ex: Informações adicionais do pagamento"
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
              max={dataMaxima}
              aria-invalid={dataEhFutura}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          {erro && <p className="erro-form" role="alert">{erro}</p>}

          <button type="submit" className="btn-primary" disabled={enviando || dataEhFutura} style={{ width: '100%', padding: 14 }}>
            {enviando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Adicionar ao Orçamento'}
          </button>
        </form>
      </div>
    </div>
  );
}
