import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RotaProtegida({ children }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return null;
  if (!usuario) return <Navigate to="/login" replace />;

  return children;
}
