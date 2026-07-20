import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './Auth.css';
import Footer from '../components/Footer';

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (novaSenha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/auth/redefinir-senha', { token, novaSenha });
      setSucesso(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível redefinir a senha.');
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <main className="auth-container">
        <div className="panel auth-card">
          <div className="auth-header">
            <span className="label">Sistema</span>
            <h1>Controle de Despesas</h1>
          </div>
          <p className="erro-form" role="alert">Link inválido — faltou o token de redefinição.</p>
          <p className="auth-rodape label">
            <Link to="/esqueci-senha" className="link-destacado">Pedir um novo link</Link>
          </p>
        </div>
        <Footer />
      </main>
    );
  }

  if (sucesso) {
    return (
      <main className="auth-container">
        <div className="panel auth-card">
          <div className="auth-header">
            <span className="label">Sistema</span>
            <h1>Controle de Despesas</h1>
          </div>
          <p style={{ lineHeight: 1.6 }} role="status">
            Senha redefinida! Levando você pro login...
          </p>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="auth-container">
      <form className="panel auth-card" onSubmit={enviar}>
        <div className="auth-header">
          <span className="label">Sistema</span>
          <h1>Definir nova senha</h1>
        </div>

        <div className="campo">
          <label className="label" htmlFor="nova-senha">Nova senha</label>
          <input
            id="nova-senha"
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="mínimo 6 caracteres"
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="confirmar-senha">Confirmar nova senha</label>
          <input
            id="confirmar-senha"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder="repita a senha"
            autoComplete="new-password"
          />
        </div>

        {erro && <p className="erro-form" role="alert">{erro}</p>}

        <button type="submit" className="btn-primary" disabled={enviando} style={{ width: '100%', padding: 14 }}>
          {enviando ? 'Salvando...' : 'Redefinir senha'}
        </button>
      </form>
      <Footer />
    </main>
  );
}
