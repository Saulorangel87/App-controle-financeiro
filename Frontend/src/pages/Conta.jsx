import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Conta.css';

const CONFIRMACAO_ESPERADA = 'EXCLUIR';

export default function Conta() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoNovaSenha, setConfirmacaoNovaSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const [encerrandoSessoes, setEncerrandoSessoes] = useState(false);
  const [erroSessoes, setErroSessoes] = useState('');

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const podeExcluir = senha && confirmacao === CONFIRMACAO_ESPERADA;

  async function alterarSenha(e) {
    e.preventDefault();
    setErroSenha('');
    setSucessoSenha('');

    if (novaSenha.length < 8) {
      setErroSenha('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmacaoNovaSenha) {
      setErroSenha('A confirmação da nova senha não confere.');
      return;
    }

    setSalvandoSenha(true);
    try {
      const res = await api.post('/auth/alterar-senha', { senhaAtual, novaSenha });
      setSucessoSenha(res.data?.mensagem || 'Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacaoNovaSenha('');
    } catch (err) {
      setErroSenha(err.response?.data?.erro || 'Não foi possível alterar a senha.');
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function sairDeTodosDispositivos() {
    setErroSessoes('');
    setEncerrandoSessoes(true);
    try {
      await api.post('/auth/encerrar-sessoes');
      await logout();
      navigate('/login');
    } catch (err) {
      setErroSessoes(err.response?.data?.erro || 'Não foi possível encerrar as sessões.');
      setEncerrandoSessoes(false);
    }
  }

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

      <form className="panel conta-secao" onSubmit={alterarSenha}>
        <div>
          <strong>Alterar senha</strong>
          <p className="label" style={{ lineHeight: 1.6, marginTop: 4 }}>
            Ao trocar sua senha, outros dispositivos conectados serão desconectados automaticamente.
          </p>
        </div>

        <div className="campo">
          <label className="label" htmlFor="conta-senha-atual">Senha atual</label>
          <input
            id="conta-senha-atual"
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="conta-nova-senha">Nova senha</label>
          <input
            id="conta-nova-senha"
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="mínimo 8 caracteres"
            autoComplete="new-password"
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="conta-confirmar-nova-senha">Confirmar nova senha</label>
          <input
            id="conta-confirmar-nova-senha"
            type="password"
            value={confirmacaoNovaSenha}
            onChange={(e) => setConfirmacaoNovaSenha(e.target.value)}
            placeholder="repita a nova senha"
            autoComplete="new-password"
          />
        </div>

        {erroSenha && (
          <p className="label" style={{ color: 'var(--danger)' }} role="alert">{erroSenha}</p>
        )}
        {sucessoSenha && (
          <p className="label" style={{ color: 'var(--ok)' }} role="status">{sucessoSenha}</p>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={!senhaAtual || !novaSenha || !confirmacaoNovaSenha || salvandoSenha}
        >
          {salvandoSenha ? 'Salvando...' : 'Atualizar senha'}
        </button>
      </form>

      <div className="panel conta-secao">
        <div>
          <strong>Sessões ativas</strong>
          <p className="label" style={{ lineHeight: 1.6, marginTop: 4 }}>
            Encerra todas as sessões abertas em celulares, computadores ou navegadores, incluindo esta.
          </p>
        </div>

        {erroSessoes && (
          <p className="label" style={{ color: 'var(--danger)' }} role="alert">{erroSessoes}</p>
        )}

        <button
          type="button"
          className="botao-encerrar-sessoes"
          onClick={sairDeTodosDispositivos}
          disabled={encerrandoSessoes}
        >
          {encerrandoSessoes ? 'Encerrando...' : 'Sair de todos os dispositivos'}
        </button>
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
