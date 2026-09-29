import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Conta.css';

const CONFIRMACAO_ESPERADA = 'EXCLUIR';

export default function Conta() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const podeExcluir = senha && confirmacao === CONFIRMACAO_ESPERADA;

  async function excluirConta(e) {
    e.preventDefault();
    if (!podeExcluir) return;

    setErro('');
    setEnviando(true);
    try {
      await api.delete('/auth/conta', { data: { senha } });
      logout();
      navigate('/login');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível excluir a conta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="conta-pagina">
      <div className="panel conta-dados">
        <span className="label">Conta</span>
        <h2>{usuario?.nome}</h2>
        <p className="label">{usuario?.email}</p>
      </div>

      <form className="panel conta-excluir" onSubmit={excluirConta}>
        <div>
          <strong style={{ color: 'var(--danger)' }}>Excluir minha conta</strong>
          <p className="label" style={{ lineHeight: 1.6, marginTop: 4 }}>
            Isso apaga permanentemente sua conta e todos os seus dados — despesas,
            categorias, entradas, orçamento, recorrentes e metas. Essa ação não pode
            ser desfeita.
          </p>
        </div>

        <div className="campo">
          <label className="label" htmlFor="conta-senha">Senha atual</label>
          <input
            id="conta-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="conta-confirmacao">
            Digite {CONFIRMACAO_ESPERADA} para confirmar
          </label>
          <input
            id="conta-confirmacao"
            type="text"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>

        {erro && (
          <p className="label" style={{ color: 'var(--danger)' }} role="alert">{erro}</p>
        )}

        <button
          type="submit"
          className="botao-excluir-conta"
          disabled={!podeExcluir || enviando}
        >
          {enviando ? 'Excluindo...' : 'Excluir minha conta permanentemente'}
        </button>
      </form>
    </div>
  );
}
