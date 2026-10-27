import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Entradas from './Entradas';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

test('permite editar uma entrada existente pela tela de entradas', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/entradas/meses') return Promise.resolve({ data: ['2026-10'] });
    if (rota === '/entradas') {
      return Promise.resolve({
        data: {
          entradas: [
            { id: 7, origem: 'Freelance', descricao: 'Projeto A', valor: 500, data: '2026-10-10' },
          ],
          total: 1,
          totalGeral: 500,
          totalPaginas: 1,
        },
      });
    }
    return Promise.resolve({ data: [] });
  });
  api.put.mockResolvedValue({ data: {} });

  render(<MemoryRouter><Entradas /></MemoryRouter>);

  expect(await screen.findByText('Freelance')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Editar entrada Freelance' }));
  expect(await screen.findByText('Editar Entrada')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'Consultoria' } });
  fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '750' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

  await waitFor(() => {
    expect(api.put).toHaveBeenCalledWith('/entradas/7', {
      origem: 'Consultoria',
      descricao: 'Projeto A',
      valor: 750,
      data: '2026-10-10',
    });
  });
});
