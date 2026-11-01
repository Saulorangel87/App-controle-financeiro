import { ArrowRight, Check, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';
import { useMes } from '../contexts/MesContext';
import { formatarMoeda } from '../utils/formatters';
import { rotuloMes, somarMeses } from '../utils/datas';
import './AvisoNovidades.css';

const VERSAO_ATUAL = 'v2.1.4';
const CHAVE_VISTA = `controle-despesas:novidades:${VERSAO_ATUAL}`;

// Regras do saldo acumulado (v2.1.3). Quem já usava o app precisa saber que
// o orçamento do mês mudou de significado e conferir o próprio saldo.
const regras = [
  'O que sobra no mês (orçamento − gastos) passa para o mês seguinte. Se faltar, o negativo também passa.',
  'No mês novo, lance só o que você recebeu com o + — o app soma ao saldo que veio do mês anterior.',
  'O saldo começa a contar a partir de outubro de 2026; meses anteriores não entram na conta.',
  'O botão "Copiar mês anterior" saiu: o saldo já vem sozinho.',
  'Metas de economia agora contam também o orçamento definido no "editar".',
];

function jaFoiVista() {
  try {
    return window.localStorage.getItem(CHAVE_VISTA) === '1';
  } catch {
    return false;
  }
}

function registrarVista() {
  try {
    window.localStorage.setItem(CHAVE_VISTA, '1');
  } catch {
    // O aviso continua funcionando mesmo se o navegador bloquear storage.
  }
}

export default function AvisoNovidades() {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState(null);
  const { mesAtual, selecionarMes } = useMes();
  const navigate = useNavigate();

  useEffect(() => {
    if (!jaFoiVista()) {
      registrarVista();
      setAberto(true);
    }
  }, []);

  // O saldo do próprio usuário, para ele conferir com o banco.
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    api.get('/resumo', { params: { mes: mesAtual } })
      .then((res) => { if (ativo) setResumo(res.data); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [aberto, mesAtual]);

  useEffect(() => {
    if (!aberto) return undefined;
    function fecharComEscape(evento) {
      if (evento.key === 'Escape') setAberto(false);
    }
    document.addEventListener('keydown', fecharComEscape);
    return () => document.removeEventListener('keydown', fecharComEscape);
  }, [aberto]);

  if (!aberto) return null;

  function corrigirSaldo() {
    setAberto(false);
    selecionarMes(mesAtual);
    navigate('/?corrigirSaldo=1');
  }

  const temOrcamento = resumo && (resumo.orcamentoTotal !== 0 || resumo.saldoAnterior !== 0);
  // Saldo na conta hoje = Disponível + contas agendadas (ainda não saíram).
  const saldoHoje = resumo ? resumo.disponivel + (resumo.gastoAgendado || 0) : 0;

  return (
    <div className="novidades-overlay" role="presentation" onClick={() => setAberto(false)}>
      <section
        className="panel aviso-novidades"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-aviso-novidades"
        onClick={(evento) => evento.stopPropagation()}
      >
        <button className="aviso-novidades-fechar" onClick={() => setAberto(false)} aria-label="Fechar novidades">
          <X size={18} />
        </button>

        <span className="aviso-novidades-selo">Nova versão</span>
        <span className="label">Controle de Despesas · {VERSAO_ATUAL}</span>
        <h2 id="titulo-aviso-novidades">Seu saldo agora passa de um mês para o outro.</h2>
        <p className="aviso-novidades-intro">
          O orçamento do mês não zera mais na virada: ele funciona como uma conta corrente.
        </p>

        <ul className="aviso-novidades-lista">
          {regras.map((regra) => (
            <li key={regra}><Check size={15} /> {regra}</li>
          ))}
        </ul>

        {temOrcamento && (
          <div className="aviso-saldo">
            <span className="label">Pelo app, você tem hoje</span>
            <strong>{formatarMoeda(saldoHoje)}</strong>
            {resumo.saldoAnterior !== 0 && (
              <span className="aviso-saldo-detalhe">
                inclui {formatarMoeda(resumo.saldoAnterior)} de saldo de {rotuloMes(somarMeses(mesAtual, -1))}
              </span>
            )}
            <p>Confira com o saldo da sua conta no banco. Se não bater, clique em Corrigir saldo e digite quanto você tem hoje — o app ajusta o resto sozinho.</p>
          </div>
        )}

        <div className="aviso-novidades-acoes">
          {temOrcamento ? (
            <>
              <button className="botao-adiar-novidades" onClick={corrigirSaldo}>Corrigir saldo</button>
              <button className="btn-primary aviso-novidades-link" onClick={() => setAberto(false)}>
                Está certo <Check size={14} />
              </button>
            </>
          ) : (
            <>
              <button className="botao-adiar-novidades" onClick={() => setAberto(false)}>Agora não</button>
              <Link to="/novidades" className="btn-primary aviso-novidades-link" onClick={() => setAberto(false)}>
                Ver novidades <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
