import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Despesas from './Despesas';
import api from '../services/api';
import { mesAtualISO } from '../utils/datas';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../contexts/DespesaModalContext', () => ({
  useDespesaModal: () => ({ abrirEdicao: vi.fn(), abrirNovo: vi.fn() }),
}));

test('renderiza a lista de despesas vinda da API e filtra por busca, categoria e forma de pagamento', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/despesas/meses') return Promise.resolve({ data: ['2026-09'] });
    if (rota === '/categorias') return Promise.resolve({ data: [{ id: 1, nome: 'Alimentação' }] });
    if (rota === '/despesas') {
      return Promise.resolve({
        data: {
          despesas: [{
            id: 1, descricao: 'Supermercado', valor: 150, data: '2026-09-10',
            categoria_id: 1, categoria_nome: 'Alimentação', categoria_icone: 'circle', categoria_cor: '#000',
            forma_pagamento: 'pix',
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
  // Abre filtrada no mês atual, não em "Todos os meses".
  expect(api.get).toHaveBeenCalledWith('/despesas', {
    params: { pagina: 1, porPagina: 20, mes: mesAtualISO() },
  });

  fireEvent.change(screen.getByLabelText('Buscar despesas por descrição'), { target: { value: 'mercado' } });
  fireEvent.change(screen.getByLabelText('Filtrar despesas por categoria'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Filtrar despesas por forma de pagamento'), { target: { value: 'pix' } });

  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith('/despesas', {
      params: {
        pagina: 1,
        porPagina: 20,
        mes: mesAtualISO(),
        busca: 'mercado',
        categoria_id: '1',
        forma_pagamento: 'pix',
      },
    });
  });

  // Excluir não pergunta mais "tem certeza?": o aviso com "Desfazer" é o
  // caminho de volta.
  const confirmar = vi.spyOn(window, 'confirm');
  api.delete.mockResolvedValue({});
  api.post.mockResolvedValue({ data: {} });

  fireEvent.click(screen.getByRole('button', { name: 'Excluir despesa' }));
  expect(confirmar).not.toHaveBeenCalled();
  const botaoDesfazer = await screen.findByRole('button', { name: 'Desfazer' });
  fireEvent.click(botaoDesfazer);

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/historico/desfazer', {
      tabela: 'despesas',
      registro_id: 1,
    });
  });
});
