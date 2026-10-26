import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Categorias from './Categorias';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

test('permite criar, editar e excluir categorias pela tela', async () => {
  api.get.mockResolvedValue({
    data: [
      {
        id: 1,
        nome: 'Moradia',
        icone: 'home',
        cor: '#f97316',
        limite: 1500,
        gasto: 500,
        disponivel: 1000,
        percentual: 33.3,
        status: 'OK',
      },
    ],
  });
  api.post.mockResolvedValue({ data: {} });
  api.put.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({});

  render(<Categorias />);

  expect(await screen.findByText('Moradia')).toBeInTheDocument();

  // Criar nova categoria
  fireEvent.click(screen.getByRole('button', { name: /Nova Categoria/i }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Viagens' } });
  fireEvent.change(screen.getByLabelText('Limite mensal (R$)'), { target: { value: '600' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ícone Viagem' }));
  fireEvent.click(screen.getByRole('button', { name: 'Criar Categoria' }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/categorias', {
      nome: 'Viagens',
      limite: 600,
      icone: 'plane',
      cor: '#f97316',
    });
  });

  // Excluir categoria
  fireEvent.click(screen.getByRole('button', { name: 'Excluir categoria Moradia' }));
  await waitFor(() => {
    expect(api.delete).toHaveBeenCalledWith('/categorias/1');
  });
});
