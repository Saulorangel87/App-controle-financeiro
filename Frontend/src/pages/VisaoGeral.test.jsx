import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VisaoGeral from './VisaoGeral';
import api from '../services/api';
import { mesAtualISO } from '../utils/datas';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../contexts/DespesaModalContext', () => ({
  useDespesaModal: () => ({ abrirEdicao: vi.fn(), abrirNovo: vi.fn() }),
}));

const resumoMock = {
  totalGasto: 100,
  orcamentoTotal: 500,
  orcamentoBase: 500,
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
  expect(document.body.textContent).toContain('No ritmo atual (10/31 dias), você deve gastar');
  expect(document.body.textContent).toContain('310,00');
  expect(document.body.textContent).toContain('190,00 abaixo do orçamento');
  expect(screen.getByText('Fatura do Cartão (Crédito)')).toBeInTheDocument();
  expect(document.body.textContent).toContain('245,50');
  expect(screen.getByRole('button', { name: /Configurar dia de fechamento do cartão/i })).toHaveTextContent('fecha dia 10');
});

test('oferece copiar o orçamento do mês anterior quando o mês só tem entradas avulsas', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') {
      return Promise.resolve({
        data: { ...resumoMock, orcamentoTotal: 300, orcamentoBase: 0, orcamentoMesAnterior: 4200 },
      });
    }
    if (rota === '/categorias') return Promise.resolve({ data: [] });
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    if (rota === '/entradas') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: {} });

  render(
    <MemoryRouter>
      <VisaoGeral />
    </MemoryRouter>
  );

  const botaoCopiar = await screen.findByRole('button', { name: /Copiar mês anterior \(R\$\s4\.200,00\)/i });
  expect(screen.queryByLabelText(/Repetir todo mês/i)).not.toBeInTheDocument();
  fireEvent.click(botaoCopiar);

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/orcamento/copiar-anterior', null, { params: { mes: mesAtualISO() } });
  });
  expect(api.put).not.toHaveBeenCalled();
});
