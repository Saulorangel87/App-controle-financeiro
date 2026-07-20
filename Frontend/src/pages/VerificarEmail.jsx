import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './Auth.css';
import Footer from '../components/Footer';

export default function VerificarEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [estado, setEstado] = useState('carregando'); // carregando | sucesso | erro
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (!token) {
      setEstado('erro');
      setMensagem('Link inválido — faltou o token de confirmação.');
      return;
    }
    api.post('/auth/verificar-email', { token })
      .then((res) => {
        setEstado('sucesso');
        setMensagem(res.data.mensagem);
      })
      .catch((err) => {
        setEstado('erro');
        setMensagem(err.response?.data?.erro || 'Não foi possível confirmar o email.');
      });
  }, [token]);

  return (
    <main className="auth-container">
      <div className="panel auth-card">
        <div className="auth-header">
          <span className="label">Sistema</span>
          <h1>Controle de Despesas</h1>
        </div>

        {estado === 'carregando' && <p className="label" role="status">Confirmando seu email...</p>}

        {estado === 'sucesso' && (
          <>
            <p style={{ lineHeight: 1.6 }}>{mensagem}</p>
            <p className="auth-rodape label">
              <Link to="/login" className="link-destacado">Ir para o login</Link>
            </p>
          </>
        )}

        {estado === 'erro' && (
          <>
            <p className="erro-form" role="alert">{mensagem}</p>
            <p className="label" style={{ lineHeight: 1.6 }}>
              O link pode ter expirado (validade de 24 horas). Você pode pedir um novo
              na tela de login, na opção "Reenviar email de confirmação".
            </p>
            <p className="auth-rodape label">
              <Link to="/login" className="link-destacado">Ir para o login</Link>
            </p>
          </>
        )}
      </div>
      <Footer />
    </main>
  );
}
