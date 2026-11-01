import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AvisoNovidades from './AvisoNovidades';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

function MostraRota() {
  const local = useLocation();
  return <span data-testid="rota">{local.pathname + local.search}</span>;
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/despesas']}>
      <AvisoNovidades />
      <Routes>
        <Route path="*" element={<MostraRota />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.get.mockReset();
});

test('explica as regras do saldo e mostra o saldo do usuário para conferir', async () => {
  api.get.mockResolvedValue({ data: { orcamentoTotal: 4669.39, saldoAnterior: 1000 } });
  renderizar();

  expect(screen.getByRole('dialog')).toHaveTextContent('Seu saldo agora passa de um mês para o outro.');
  expect(screen.getByRole('dialog')).toHaveTextContent('Se faltar, o negativo também passa');
  expect(await screen.findByText(/4\.669,39/)).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveTextContent(/inclui\s*R\$\s1\.000,00 de saldo de/);

  fireEvent.click(screen.getByRole('button', { name: 'Corrigir saldo' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('rota')).toHaveTextContent('/?editarOrcamento=1');
});

test('aparece uma vez só por navegador', async () => {
  api.get.mockResolvedValue({ data: { orcamentoTotal: 3000, saldoAnterior: 0 } });
  const { unmount } = renderizar();
  fireEvent.click(await screen.findByRole('button', { name: /Está certo/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  unmount();

  renderizar();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('sem orçamento, não pede para conferir saldo', async () => {
  api.get.mockResolvedValue({ data: { orcamentoTotal: 0, saldoAnterior: 0 } });
  renderizar();
  expect(await screen.findByRole('link', { name: /Ver novidades/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Corrigir saldo' })).not.toBeInTheDocument();
});
