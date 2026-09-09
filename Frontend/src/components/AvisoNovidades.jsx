import { ArrowRight, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './AvisoNovidades.css';

const VERSAO_ATUAL = 'v1.6.0';
const CHAVE_VISTA = `controle-despesas:novidades:${VERSAO_ATUAL}`;

const destaques = [
  'Compras parceladas com avanço automático da parcela',
  'Total de recorrentes que diminui ao marcar contas como pagas',
  'Entradas e orçamento mensal organizados separadamente',
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

  useEffect(() => {
    if (!jaFoiVista()) {
      registrarVista();
      setAberto(true);
    }
  }, []);

  useEffect(() => {
    if (!aberto) return undefined;
    function fecharComEscape(evento) {
      if (evento.key === 'Escape') setAberto(false);
    }
    document.addEventListener('keydown', fecharComEscape);
    return () => document.removeEventListener('keydown', fecharComEscape);
  }, [aberto]);

  if (!aberto) return null;

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
        <h2 id="titulo-aviso-novidades">Mais controle no seu mês.</h2>
        <p className="aviso-novidades-intro">
          Chegaram melhorias para acompanhar parcelas, contas recorrentes e o dinheiro que entra.
        </p>

        <ul className="aviso-novidades-lista">
          {destaques.map((destaque) => (
            <li key={destaque}><Check size={15} /> {destaque}</li>
          ))}
        </ul>

        <div className="aviso-novidades-acoes">
          <button className="botao-adiar-novidades" onClick={() => setAberto(false)}>Agora não</button>
          <Link to="/novidades" className="btn-primary aviso-novidades-link" onClick={() => setAberto(false)}>
            Ver novidades <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
