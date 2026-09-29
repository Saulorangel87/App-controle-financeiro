import { useEffect, useState } from 'react';
import api from '../services/api';
import './ModalNovaDespesa.css';

const LIMITE_DESCRICAO = 80;
const LIMITE_DIVIDIDA_COM = 40;
const FORMAS_PAGAMENTO = [
  { valor: '', rotulo: 'Não informado' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'credito', rotulo: 'Crédito' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'outro', rotulo: 'Outro' },
];

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
  const [categoriaTocada, setCategoriaTocada] = useState(false);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(false);
  const [dividirDespesa, setDividirDespesa] = useState(false);
  const [divididaCom, setDivididaCom] = useState('');
  const [divisaoValor, setDivisaoValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');

  const dataEhFutura = data > hoje();

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
      setDividirDespesa(Boolean(despesaEditando.dividida_com));
      setDivididaCom(despesaEditando.dividida_com || '');
      setDivisaoValor(despesaEditando.divisao_valor != null ? String(despesaEditando.divisao_valor) : '');
      setFormaPagamento(despesaEditando.forma_pagamento || '');
    } else {
      setDescricao('');
      setValor('');
      setData(hoje());
      setDividirDespesa(false);
      setDivididaCom('');
      setDivisaoValor('');
      setFormaPagamento('');
    }
    setCategoriaTocada(false);
    setSugestaoAtiva(false);
    setErro('');
  }, [aberto, despesaEditando]);

  // Sugere categoria pelo histórico de descrições parecidas, só em despesa
  // nova e enquanto o usuário não tiver escolhido a categoria manualmente.
  useEffect(() => {
    if (!aberto || editando || categoriaTocada) return;

    const texto = descricao.trim();
    if (texto.length < 3) {
      setSugestaoAtiva(false);
      return;
    }

    const temporizador = setTimeout(() => {
      api.get('/despesas/sugestao-categoria', { params: { descricao: texto } })
        .then((res) => {
          const sugerida = res.data.categoria_id;
          if (sugerida && categorias.some((c) => c.id === sugerida)) {
            setCategoriaId(sugerida);
            setSugestaoAtiva(true);
          }
        })
        .catch(() => {});
    }, 400);

    return () => clearTimeout(temporizador);
  }, [descricao, aberto, editando, categoriaTocada, categorias]);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  if (!aberto) return null;

  function selecionarCategoria(id) {
    setCategoriaId(id);
    setCategoriaTocada(true);
    setSugestaoAtiva(false);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (!descricao.trim() || !valor || !categoriaId || !data) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (data > hoje()) {
      setErro('Não é possível cadastrar uma despesa com data futura.');
      return;
    }
    if (dividirDespesa && (!divididaCom.trim() || !divisaoValor)) {
      setErro('Preencha com quem dividiu e o valor da outra pessoa.');
      return;
    }
    if (dividirDespesa && Number(divisaoValor) > Number(valor)) {
      setErro('O valor da outra pessoa não pode ultrapassar o valor total da despesa.');
      return;
    }

    setEnviando(true);
    try {
      const payload = {
        descricao: descricao.trim(),
        valor: Number(valor),
        categoria_id: Number(categoriaId),
        data,
        dividida_com: dividirDespesa ? divididaCom.trim() : null,
        divisao_valor: dividirDespesa ? Number(divisaoValor) : null,
        forma_pagamento: formaPagamento || null,
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
            <label className="label" htmlFor="campo-descricao-despesa">Descrição</label>
            <input
              id="campo-descricao-despesa"
              type="text"
              placeholder="ex: Supermercado"
              value={descricao}
              maxLength={LIMITE_DESCRICAO}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <span className="contador-caracteres">{descricao.length}/{LIMITE_DESCRICAO}</span>
          </div>

          <div className="campo">
            <label className="label" htmlFor="campo-valor-despesa">Valor (R$)</label>
            <input
              id="campo-valor-despesa"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="label" htmlFor="campo-categoria-despesa">Categoria</label>
            <select
              id="campo-categoria-despesa"
              value={categoriaId}
              onChange={(e) => selecionarCategoria(e.target.value)}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {sugestaoAtiva && (
              <span className="dica-sugestao">Categoria sugerida com base no histórico</span>
            )}
          </div>

          <div className="campo">
            <label className="label" htmlFor="campo-data-despesa">Data</label>
            <input
              id="campo-data-despesa"
              type="date"
              value={data}
              max={hoje()}
              aria-invalid={dataEhFutura}
              aria-describedby={dataEhFutura ? 'aviso-data-futura' : undefined}
              onChange={(e) => setData(e.target.value)}
            />
            {dataEhFutura && (
              <p className="erro-form" id="aviso-data-futura" role="alert">
                ⚠ Data futura não é permitida — despesas só podem ser cadastradas até hoje.
              </p>
            )}
          </div>

          <div className="campo">
            <label className="label" htmlFor="campo-forma-pagamento">Forma de pagamento</label>
            <select
              id="campo-forma-pagamento"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            >
              {FORMAS_PAGAMENTO.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))}
            </select>
          </div>

          <div className="campo campo-checkbox">
            <label className="rotulo-checkbox" htmlFor="campo-dividir-despesa">
              <input
                id="campo-dividir-despesa"
                type="checkbox"
                checked={dividirDespesa}
                onChange={(e) => setDividirDespesa(e.target.checked)}
              />
              Dividir com alguém
            </label>
          </div>

          {dividirDespesa && (
            <div className="linha-divisao">
              <div className="campo">
                <label className="label" htmlFor="campo-dividida-com">Dividida com</label>
                <input
                  id="campo-dividida-com"
                  type="text"
                  placeholder="ex: Ana"
                  value={divididaCom}
                  maxLength={LIMITE_DIVIDIDA_COM}
                  onChange={(e) => setDivididaCom(e.target.value)}
                />
              </div>
              <div className="campo">
                <label className="label" htmlFor="campo-divisao-valor">Valor da outra pessoa (R$)</label>
                <input
                  id="campo-divisao-valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={divisaoValor}
                  onChange={(e) => setDivisaoValor(e.target.value)}
                />
              </div>
            </div>
          )}

          {erro && <p className="erro-form" role="alert">{erro}</p>}

          <button type="submit" className="btn-primary" disabled={enviando || dataEhFutura} style={{ width: '100%', padding: 14 }}>
            {enviando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Adicionar Despesa'}
          </button>
        </form>
      </div>
    </div>
  );
}
