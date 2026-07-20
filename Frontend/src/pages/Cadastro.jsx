import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';
import Footer from '../components/Footer';

export default function Cadastro() {
  const { registrar } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cadastroFeito, setCadastroFeito] = useState(false);

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
      setCadastroFeito(true);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível criar a conta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (cadastroFeito) {
    return (
      <main className="auth-container">
        <div className="panel auth-card">
          <div className="auth-header">
            <span className="label">Sistema</span>
            <h1>Controle de Despesas</h1>
          </div>
          <p style={{ lineHeight: 1.6 }}>
            Conta criada! Mandamos um link de confirmação para <strong>{email}</strong>.
            Verifique sua caixa de entrada (e o spam, por garantia) e clique no link
            para ativar sua conta.
          </p>
          <p className="auth-rodape label">
            <Link to="/login" className="link-destacado">Ir para o login</Link>
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
          Já tem conta? <Link to="/login" className="link-destacado">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
