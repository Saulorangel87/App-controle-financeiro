import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const loginMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}));

test('envia email e senha ao submeter o formulário de login', async () => {
  loginMock.mockResolvedValueOnce();

  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText('Email', { selector: 'input' }), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('Senha', { selector: 'input' }), { target: { value: 'senha123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  await waitFor(() => expect(loginMock).toHaveBeenCalledWith('user@example.com', 'senha123'));
});
