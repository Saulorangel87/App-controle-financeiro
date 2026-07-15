import { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RotaProtegida from './components/RotaProtegida';
import VisaoGeral from './pages/VisaoGeral';
import Despesas from './pages/Despesas';
import Categorias from './pages/Categorias';
import Alertas from './pages/Alertas';
import Relatorio from './pages/Relatorio';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import { useAuth } from './contexts/AuthContext';
import { DespesaModalProvider } from './contexts/DespesaModalContext';
import api from './services/api';

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
  );
}
