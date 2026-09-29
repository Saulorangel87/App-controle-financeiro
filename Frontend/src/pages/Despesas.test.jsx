import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Despesas from './Despesas';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../contexts/DespesaModalContext', () => ({
  useDespesaModal: () => ({ abrirEdicao: vi.fn(), abrirNovo: vi.fn() }),
}));

test('renderiza a lista de despesas vinda da API, sem quebrar', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/despesas/meses') return Promise.resolve({ data: ['2026-09'] });
    if (rota === '/despesas') {
      return Promise.resolve({
        data: {
          despesas: [{
            id: 1, descricao: 'Supermercado', valor: 150, data: '2026-09-10',
            categoria_id: 1, categoria_nome: 'Alimentação', categoria_icone: 'circle', categoria_cor: '#000',
          }],
          total: 1,
          totalGeral: 150,
          totalPaginas: 1,
        },
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <Despesas />
    </MemoryRouter>
  );

  expect(await screen.findByText('Supermercado')).toBeInTheDocument();
});
