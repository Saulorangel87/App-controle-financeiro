import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RotaProtegida from './RotaProtegida';

const useAuthMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

function renderComEstado(estadoAuth) {
  useAuthMock.mockReturnValue(estadoAuth);
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route path="/" element={<RotaProtegida><p>Área logada</p></RotaProtegida>} />
      </Routes>
    </MemoryRouter>
  );
}

test('redireciona para /login quando não há usuário autenticado', () => {
  renderComEstado({ usuario: null, carregando: false });
  expect(screen.getByText('Tela de login')).toBeInTheDocument();
});

test('mostra o conteúdo protegido quando há usuário autenticado', () => {
  renderComEstado({ usuario: { id: 1, nome: 'Teste' }, carregando: false });
  expect(screen.getByText('Área logada')).toBeInTheDocument();
});
