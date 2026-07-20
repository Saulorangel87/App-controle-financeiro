import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './Auth.css';
import Footer from '../components/Footer';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setPrecisaConfirmar(false);
    setReenviado(false);
    setEnviando(true);
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      if (err.response?.data?.emailNaoVerificado) {
        setPrecisaConfirmar(true);
      }
      setErro(err.response?.data?.erro || 'Não foi possível entrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function reenviarConfirmacao() {
    setReenviando(true);
    try {
      await api.post('/auth/reenviar-verificacao', { email });
      setReenviado(true);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <main className="auth-container">
      <form className="panel auth-card" onSubmit={enviar}>
        <div className="auth-header">
          <span className="label">Sistema</span>
          <h1>Controle de Despesas</h1>
        </div>

        <div className="campo">
          <label className="label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="login-senha">Senha</label>
          <input
            id="login-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
          />
        </div>

        {erro && <p className="erro-form" role="alert">{erro}</p>}

        {precisaConfirmar && !reenviado && (
          <button
            type="button"
            className="link-destacado"
            style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
            onClick={reenviarConfirmacao}
            disabled={reenviando}
          >
            {reenviando ? 'Reenviando...' : 'Reenviar email de confirmação'}
          </button>
        )}
        {reenviado && (
          <p className="label" role="status">Link reenviado — confira sua caixa de entrada.</p>
        )}

        <button type="submit" className="btn-primary" disabled={enviando} style={{ width: '100%', padding: 14 }}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="auth-rodape label">
          Não tem conta? <Link to="/cadastro" className="link-destacado">Cadastre-se</Link>
        </p>
        <p className="auth-rodape label">
          <Link to="/esqueci-senha" className="link-destacado">Esqueci minha senha</Link>
        </p>
      </form>
      <Footer />
    </main>
  );
}
