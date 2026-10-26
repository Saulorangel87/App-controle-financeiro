import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DespesasRecorrentes from './DespesasRecorrentes';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

test('marcar conta recorrente como paga abre modal de despesa e desmarcar envia pago: false', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/recorrentes') {
      return Promise.resolve({
        data: {
          itens: [
            { id: 1, descricao: 'Conta de luz', valor: 150, dia_vencimento: 10, pago: false },
            { id: 2, descricao: 'Internet', valor: 100, dia_vencimento: 15, pago: true, despesa_paga_id: 99 },
          ],
          total: 150,
          totalCheio: 250,
          totalPago: 100,
        },
      });
    }
    if (rota === '/categorias') {
      return Promise.resolve({
        data: [
          { id: 10, nome: 'Alimentação' },
          { id: 20, nome: 'Moradia' },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  api.patch.mockResolvedValue({ data: {} });

  render(<DespesasRecorrentes />);

  expect(await screen.findByText('Conta de luz')).toBeInTheDocument();
  expect(screen.getByText(/despesa lançada/)).toBeInTheDocument();

  // Clicar numa conta não paga abre o modal com valor e categoria Moradia preenchidos
  fireEvent.click(screen.getByRole('button', { name: 'Marcar Conta de luz como paga este mês' }));
  expect(await screen.findByRole('dialog', { name: 'Pagar Conta de luz' })).toBeInTheDocument();

  await waitFor(() => expect(screen.getByLabelText('Categoria')).toHaveValue('20'));
  fireEvent.change(screen.getByLabelText('Valor pago (R$)'), { target: { value: '162.50' } });
  fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'pix' } });
  fireEvent.click(screen.getByRole('button', { name: 'Marcar como paga e lançar' }));

  await waitFor(() => {
    expect(api.patch).toHaveBeenCalledWith('/recorrentes/1/pago', {
      pago: true,
      despesa: expect.objectContaining({
        valor: 162.5,
        categoria_id: 20,
        forma_pagamento: 'pix',
      }),
    });
  });

  // Clicar numa conta já paga desmarca direto
  fireEvent.click(screen.getByRole('button', { name: 'Marcar Internet como não paga' }));
  await waitFor(() => {
    expect(api.patch).toHaveBeenCalledWith('/recorrentes/2/pago', { pago: false });
  });
});
