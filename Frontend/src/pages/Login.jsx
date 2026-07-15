import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';
import Footer from '../components/Footer';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível entrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-container">
      <form className="panel auth-card" onSubmit={enviar}>
        <div className="auth-header">
          <span className="label">Sistema</span>
          <strong>Controle de Despesas</strong>
        </div>

        <div className="campo">
          <span className="label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoFocus
          />
        </div>

        <div className="campo">
          <span className="label">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••"
          />
        </div>

        {erro && <p className="erro-form">{erro}</p>}

        <button type="submit" className="btn-primary" disabled={enviando} style={{ width: '100%', padding: 14 }}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="auth-rodape label">
          Não tem conta? <Link to="/cadastro" style={{ color: 'var(--accent)' }}>Cadastre-se</Link>
        </p>
      </form>
      <Footer />
    </div>
  );
}
