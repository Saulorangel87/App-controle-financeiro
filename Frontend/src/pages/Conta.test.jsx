import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Conta from './Conta';
import api from '../services/api';

const logoutMock = vi.fn();

vi.mock('../services/api', () => ({
  default: { post: vi.fn(), delete: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    usuario: { id: 1, nome: 'Saulo', email: 'saulo@example.com' },
    logout: logoutMock,
  }),
}));

test('permite alterar a senha e encerrar todas as sessões pela tela Minha Conta', async () => {
  api.post.mockImplementation((rota) => {
    if (rota === '/auth/alterar-senha') {
      return Promise.resolve({ data: { mensagem: 'Senha alterada com sucesso.' } });
    }
    if (rota === '/auth/encerrar-sessoes') {
      return Promise.resolve({});
    }
    return Promise.resolve({ data: {} });
  });

  render(
    <MemoryRouter>
      <Conta />
    </MemoryRouter>
  );

  fireEvent.change(document.querySelector('#conta-senha-atual'), { target: { value: 'senha123' } });
  fireEvent.change(document.querySelector('#conta-nova-senha'), { target: { value: 'novaSenha123' } });
  fireEvent.change(document.querySelector('#conta-confirmar-nova-senha'), { target: { value: 'novaSenha123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/auth/alterar-senha', {
      senhaAtual: 'senha123',
      novaSenha: 'novaSenha123',
    });
  });
  expect(await screen.findByText('Senha alterada com sucesso.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Sair de todos os dispositivos' }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/auth/encerrar-sessoes');
  });
  expect(logoutMock).toHaveBeenCalled();
});
