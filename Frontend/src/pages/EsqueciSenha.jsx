import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Auth.css';
import Footer from '../components/Footer';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post('/auth/esqueci-senha', { email });
    } finally {
      // Sempre mostra a mesma mensagem de sucesso, exista ou não o email —
      // é assim que o backend responde de propósito, pra não revelar quais
      // emails têm conta.
      setEnviado(true);
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="auth-container">
        <div className="panel auth-card">
          <div className="auth-header">
            <span className="label">Sistema</span>
            <h1>Controle de Despesas</h1>
          </div>
          <p style={{ lineHeight: 1.6 }}>
            Se <strong>{email}</strong> tiver uma conta, você vai receber um link
            para redefinir a senha em instantes. Confira o spam, por garantia.
          </p>
          <p className="auth-rodape label">
            <Link to="/login" className="link-destacado">Voltar para o login</Link>
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
          <h1>Esqueci minha senha</h1>
        </div>

        <p className="label" style={{ lineHeight: 1.6 }}>
          Digite o email da sua conta — vamos mandar um link pra você definir uma senha nova.
        </p>

        <div className="campo">
          <label className="label" htmlFor="esqueci-email">Email</label>
          <input
            id="esqueci-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            autoFocus
          />
        </div>

        <button type="submit" className="btn-primary" disabled={enviando} style={{ width: '100%', padding: 14 }}>
          {enviando ? 'Enviando...' : 'Enviar link de redefinição'}
        </button>

        <p className="auth-rodape label">
          <Link to="/login" className="link-destacado">Voltar para o login</Link>
        </p>
      </form>
      <Footer />
    </main>
  );
}
