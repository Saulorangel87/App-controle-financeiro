import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VisaoGeral from './VisaoGeral';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../contexts/DespesaModalContext', () => ({
  useDespesaModal: () => ({ abrirEdicao: vi.fn(), abrirNovo: vi.fn() }),
}));

const resumoMock = {
  totalGasto: 100,
  orcamentoTotal: 500,
  percentualUtilizado: 20,
  disponivel: 400,
  gastoPorCategoria: [],
};

test('renderiza o dashboard com os totais vindos da API, sem quebrar', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') return Promise.resolve({ data: resumoMock });
    if (rota === '/categorias') return Promise.resolve({ data: [] });
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    if (rota === '/entradas') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <VisaoGeral />
    </MemoryRouter>
  );

  expect(await screen.findByText('Total Gasto')).toBeInTheDocument();
  expect(document.body.textContent).toContain('100,00');
});
