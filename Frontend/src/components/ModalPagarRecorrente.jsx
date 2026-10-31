import { useEffect, useState } from 'react';
import api from '../services/api';
import { useMes } from '../contexts/MesContext';
import { dataMaximaDoMes, dataPadraoDoMes } from '../utils/datas';
import { formatarMoeda } from '../utils/formatters';
import { FORMAS_PAGAMENTO } from '../utils/formasPagamento';
import './ModalEntrada.css';

// Sem categoria lembrada (primeiro pagamento da conta), sugere Moradia — onde
// costumam cair luz, água, internet e aluguel — ou a primeira da lista.
function categoriaPadrao(item, categorias) {
  if (item.categoria_id && categorias.some((c) => c.id === item.categoria_id)) return item.categoria_id;
  return (categorias.find((c) => c.nome === 'Moradia') || categorias[0])?.id ?? '';
}

export default function ModalPagarRecorrente({ item, onFechar, onPago }) {
  const { mes } = useMes();
  const dataMaxima = dataMaximaDoMes(mes);
  const [categorias, setCategorias] = useState([]);
  const [lancarDespesa, setLancarDespesa] = useState(true);
  const [valor, setValor] = useState(item.valor != null ? String(item.valor) : '');
  const [categoriaId, setCategoriaId] = useState('');
  const [data, setData] = useState(() => dataPadraoDoMes(mes));
  const [formaPagamento, setFormaPagamento] = useState(item.forma_pagamento || '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const dataEhFutura = data > dataMaxima;

  useEffect(() => {
    api.get('/categorias')
      .then((res) => {
        setCategorias(res.data);
        setCategoriaId(categoriaPadrao(item, res.data));
      })
      .catch(() => setErro('Não foi possível carregar as categorias.'));
  }, [item]);

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  async function confirmar(e) {
    e.preventDefault();
    setErro('');

    if (lancarDespesa) {
      if (!valor || Number(valor) <= 0) {
        setErro('Informe quanto foi pago.');
        return;
      }
      if (!categoriaId) {
        setErro('Escolha a categoria da despesa.');
        return;
      }
    }

    setEnviando(true);
    try {
      const res = await api.patch(`/recorrentes/${item.id}/pago`, {
        pago: true,
        ...(lancarDespesa ? {
          despesa: {
            valor: Number(valor),
            categoria_id: Number(categoriaId),
            data,
            forma_pagamento: formaPagamento || null,
          },
        } : {}),
      }, { params: { mes } });
      onPago(res.data);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível registrar o pagamento. Tente novamente.');
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-pagar-recorrente"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="label" id="titulo-pagar-recorrente">Pagar {item.descricao}</span>
          <button className="modal-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={confirmar} className="modal-form">
          <label className="checkbox-linha" htmlFor="pagar-lancar-despesa">
            <input
              id="pagar-lancar-despesa"
              type="checkbox"
              checked={lancarDespesa}
              onChange={(e) => setLancarDespesa(e.target.checked)}
            />
            Lançar também como despesa do mês
          </label>

          {lancarDespesa && (
            <>
              <div className="campo">
                <label className="label" htmlFor="pagar-valor">Valor pago (R$)</label>
                <input
                  id="pagar-valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  autoFocus
                />
                {item.valor != null && (
                  <span className="contador-caracteres">valor previsto: {formatarMoeda(item.valor)}</span>
                )}
              </div>

              <div className="campo">
                <label className="label" htmlFor="pagar-categoria">Categoria</label>
                <select id="pagar-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
                  ))}
                </select>
              </div>

              <div className="campo">
                <label className="label" htmlFor="pagar-data">Data do pagamento</label>
                <input
                  id="pagar-data"
                  type="date"
                  value={data}
                  max={dataMaxima}
                  aria-invalid={dataEhFutura}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>

              <div className="campo">
                <label className="label" htmlFor="pagar-forma">Forma de pagamento</label>
                <select id="pagar-forma" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                  <option value="">Não informado</option>
                  {FORMAS_PAGAMENTO.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {erro && <p className="erro-form" role="alert">{erro}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={enviando || (lancarDespesa && dataEhFutura)}
            style={{ width: '100%', padding: 14 }}
          >
            {enviando ? 'Salvando...' : lancarDespesa ? 'Marcar como paga e lançar' : 'Só marcar como paga'}
          </button>
        </form>
      </div>
    </div>
  );
}
