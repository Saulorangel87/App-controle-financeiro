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
  orcamentoDoMes: 500,
  saldoAnterior: 0,
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

test('nos primeiros dias do mês mostra aviso em vez de projetar um valor', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') {
      return Promise.resolve({
        data: {
          ...resumoMock, diaAtual: 1, diasNoMes: 30, projecaoMes: 0, projecaoPendente: true, diaInicioProjecao: 7,
        },
      });
    }
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <VisaoGeral />
    </MemoryRouter>
  );

  expect(await screen.findByText('Total Gasto')).toBeInTheDocument();
  expect(document.body.textContent).toContain('Projeção do mês a partir do dia 7: com só 1 dia de gastos');
  expect(document.body.textContent).not.toContain('você deve gastar');
});

test('mostra o saldo do mês anterior incluído no orçamento e não oferece mais copiar', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') {
      return Promise.resolve({
        data: { ...resumoMock, orcamentoTotal: 3000, orcamentoDoMes: 2000, saldoAnterior: 1000 },
      });
    }
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <VisaoGeral />
    </MemoryRouter>
  );

  expect(await screen.findByText('Total Gasto')).toBeInTheDocument();
  expect(document.body.textContent).toContain('3.000,00');
  expect(document.body.textContent).toMatch(/Inclui saldo do mês anterior:\s*R\$\s1\.000,00/);
  expect(screen.queryByRole('button', { name: /Copiar mês anterior/i })).not.toBeInTheDocument();
});

test('saldo negativo do mês anterior aparece como negativo', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') {
      return Promise.resolve({ data: { ...resumoMock, orcamentoTotal: 1500, orcamentoDoMes: 2000, saldoAnterior: -500 } });
    }
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <VisaoGeral />
    </MemoryRouter>
  );

  expect(await screen.findByText('Total Gasto')).toBeInTheDocument();
  expect(document.body.textContent).toContain('Inclui saldo negativo do mês anterior');
});

test('com ?corrigirSaldo=1 (aviso "Corrigir saldo") pede o saldo do banco e acerta pelo saldo-atual', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') {
      return Promise.resolve({
        data: {
          ...resumoMock, totalGasto: 1711.43, orcamentoTotal: 1957.75, disponivel: 246.32, gastoAgendado: 0,
        },
      });
    }
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    return Promise.resolve({ data: [] });
  });
  api.put.mockResolvedValue({ data: {} });

  render(
    <MemoryRouter initialEntries={['/?corrigirSaldo=1']}>
      <VisaoGeral />
    </MemoryRouter>
  );

  const campo = await screen.findByLabelText('Quanto você tem hoje na conta');
  expect(campo).toHaveValue(246.32);
  fireEvent.change(campo, { target: { value: '1957.75' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => {
    expect(api.put).toHaveBeenCalledWith('/orcamento/saldo-atual', { valor: 1957.75 }, { params: { mes: mesAtualISO() } });
  });
});

test('mostra quanto do Disponível já está reservado para contas agendadas', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/resumo') return Promise.resolve({ data: { ...resumoMock, gastoAgendado: 900 } });
    if (rota === '/despesas') return Promise.resolve({ data: { despesas: [] } });
    return Promise.resolve({ data: [] });
  });

  render(
    <MemoryRouter>
      <VisaoGeral />
    </MemoryRouter>
  );

  expect(await screen.findByText('Total Gasto')).toBeInTheDocument();
  expect(document.body.textContent).toMatch(/Já descontadas\s*R\$\s900,00 de contas agendadas/);
});
