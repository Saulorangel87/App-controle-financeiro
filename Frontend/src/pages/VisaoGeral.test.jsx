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
  projecaoMes: 310,
  diaAtual: 10,
  diasNoMes: 31,
  faturaCartao: {
    diaFechamento: 10,
    inicioCiclo: '2026-09-11',
    fimCiclo: '2026-10-10',
    total: 245.5,
    quantidade: 2,
  },
  gastoPorCategoria: [],
};

test('renderiza o dashboard com os totais e a projeção do mês vindos da API, sem quebrar', async () => {
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
  expect(document.body.textContent).toContain('No ritmo atual (10/31 dias), você fecha o mês com');
  expect(document.body.textContent).toContain('310,00');
  expect(screen.getByText('Fatura do Cartão (Crédito)')).toBeInTheDocument();
  expect(document.body.textContent).toContain('245,50');
  expect(screen.getByRole('button', { name: /Configurar dia de fechamento do cartão/i })).toHaveTextContent('fecha dia 10');
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
