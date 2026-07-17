import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RotaProtegida from './components/RotaProtegida';
import { useAuth } from './contexts/AuthContext';
import { DespesaModalProvider } from './contexts/DespesaModalContext';
import api from './services/api';

// Cada página vira um chunk JS separado, carregado só quando a rota é
// acessada — o bundle inicial fica bem menor (login/cadastro não precisam
// baixar Recharts, por exemplo, que só é usado na Visão Geral e Relatório).
const VisaoGeral = lazy(() => import('./pages/VisaoGeral'));
const Despesas = lazy(() => import('./pages/Despesas'));
const Categorias = lazy(() => import('./pages/Categorias'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Relatorio = lazy(() => import('./pages/Relatorio'));
const Login = lazy(() => import('./pages/Login'));
const Cadastro = lazy(() => import('./pages/Cadastro'));

function AreaLogada() {
  const [alertasCount, setAlertasCount] = useState(null);
  const [versao, setVersao] = useState(0);

  const recarregarAlertas = useCallback(() => {
    api.get('/resumo').then((res) => setAlertasCount(res.data.categoriasComAlerta));
  }, []);

  useEffect(() => {
    recarregarAlertas();
  }, [recarregarAlertas, versao]);

  function despesaSalva() {
    setVersao((v) => v + 1);
  }

  return (
    <DespesaModalProvider onSalvo={despesaSalva}>
      <Routes>
        <Route element={<Layout alertasCount={alertasCount} />}>
          <Route index element={<VisaoGeral key={versao} />} />
          <Route path="despesas" element={<Despesas key={versao} />} />
          <Route path="categorias" element={<Categorias key={versao} />} />
          <Route path="alertas" element={<Alertas key={versao} />} />
          <Route path="relatorio" element={<Relatorio key={versao} />} />
        </Route>
      </Routes>
    </DespesaModalProvider>
  );
}

export default function App() {
  const { carregando } = useAuth();

  if (carregando) return null;

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route
          path="/*"
          element={
            <RotaProtegida>
              <AreaLogada />
            </RotaProtegida>
          }
        />
      </Routes>
    </Suspense>
  );
}
