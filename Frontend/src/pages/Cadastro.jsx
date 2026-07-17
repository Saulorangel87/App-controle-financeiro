import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';
import Footer from '../components/Footer';

export default function Cadastro() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setEnviando(true);
    try {
      await registrar(nome, email, senha);
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível criar a conta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-container">
      <form className="panel auth-card" onSubmit={enviar}>
        <div className="auth-header">
          <span className="label">Sistema</span>
          <h1>Controle de Despesas</h1>
        </div>

        <div className="campo">
          <label className="label" htmlFor="cadastro-nome">Nome</label>
          <input
            id="cadastro-nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            autoFocus
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="cadastro-email">Email</label>
          <input
            id="cadastro-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="cadastro-senha">Senha</label>
          <input
            id="cadastro-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>

        {erro && <p className="erro-form" role="alert">{erro}</p>}

        <button type="submit" className="btn-primary" disabled={enviando} style={{ width: '100%', padding: 14 }}>
          {enviando ? 'Criando conta...' : 'Criar Conta'}
        </button>

        <p className="auth-rodape label">
          Já tem conta? <Link to="/login" style={{ color: 'var(--accent)' }}>Entrar</Link>
        </p>
      </form>
    </div>
  );
}
