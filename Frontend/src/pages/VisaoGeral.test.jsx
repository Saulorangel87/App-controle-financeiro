import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  orcamentoRecorrente: false,
  orcamentoMesAnterior: 0,
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

test('permite repetir o orçamento do mês anterior com um clique quando o mês começa zerado', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') {
      return Promise.resolve({
        data: { ...resumoMock, orcamentoTotal: 0, orcamentoMesAnterior: 4200 },
      });
    }
    if (rota === '/categorias') return Promise.resolve({ data: [] });
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    if (rota === '/entradas') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  api.put.mockResolvedValue({ data: {} });

  render(
    <MemoryRouter>
      <VisaoGeral />
    </MemoryRouter>
  );

  const botaoRepetir = await screen.findByRole('button', { name: /Repetir mês anterior/i });
  fireEvent.click(botaoRepetir);

  await waitFor(() => {
    expect(api.put).toHaveBeenCalledWith('/orcamento', { valor: 4200, recorrente: true });
  });
});
