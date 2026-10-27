import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Historico from './Historico';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const despesaExcluida = {
  id: 7, tabela: 'despesas', registro_id: 3, acao: 'excluir', criado_em: '2026-10-27 13:05:00',
  dados_antes: { id: 3, descricao: 'Mercado', valor: 99, valor_centavos: 12050, data: '2026-10-20' },
  dados_depois: null,
};
const entradaEditada = {
  id: 6, tabela: 'entradas', registro_id: 2, acao: 'editar', criado_em: '2026-10-27 12:00:00',
  dados_antes: { id: 2, origem: 'Freela', valor_centavos: 50000, data: '2026-10-10' },
  dados_depois: { id: 2, origem: 'Freela', valor_centavos: 65000, data: '2026-10-10' },
};

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

test('lista o histórico, mostra o que mudou na edição e restaura uma exclusão', async () => {
  api.get.mockResolvedValueOnce({ data: [despesaExcluida, entradaEditada] }).mockResolvedValue({ data: [entradaEditada] });
  api.post.mockResolvedValue({ data: {} });

  render(<Historico />);

  expect(await screen.findByText('Mercado')).toBeInTheDocument();
  // O valor exibido vem dos centavos, não do decimal legado.
  expect(screen.getByText(/R\$\s?120,50/)).toBeInTheDocument();
  expect(screen.getByText(/R\$\s?500,00 → R\$\s?650,00/)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Restaurar/ })).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Restaurar Mercado' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/historico/7/desfazer'));
  expect(await screen.findByText('Despesa “Mercado” restaurada.')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Mercado')).not.toBeInTheDocument());
});

test('filtra por ação e tipo pela API', async () => {
  api.get.mockResolvedValue({ data: [] });
  render(<Historico />);

  expect(await screen.findByText('Nenhuma alteração registrada com esses filtros.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filtrar por ação'), { target: { value: 'excluir' } });
  fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: 'entradas' } });

  await waitFor(() => {
    expect(api.get).toHaveBeenLastCalledWith('/historico', {
      params: { limite: 100, acao: 'excluir', tabela: 'entradas' },
    });
  });
});
