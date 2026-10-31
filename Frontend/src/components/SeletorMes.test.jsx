import { render, screen, fireEvent } from '@testing-library/react';
import SeletorMes from './SeletorMes';
import { MesProvider, useMes } from '../contexts/MesContext';
import { mesAtualISO, rotuloMes, somarMeses, MESES_A_FRENTE } from '../utils/datas';

function MesExibido() {
  const { mes } = useMes();
  return <output data-testid="mes">{mes}</output>;
}

function renderizar() {
  render(
    <MesProvider>
      <SeletorMes />
      <MesExibido />
    </MesProvider>
  );
}

test('abre no mês atual e troca o mês de todo o app pelo seletor', () => {
  const atual = mesAtualISO();
  const proximo = somarMeses(atual, 1);
  renderizar();

  expect(screen.getByTestId('mes')).toHaveTextContent(atual);
  expect(screen.getByText(rotuloMes(atual))).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Voltar para o mês atual' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
  expect(screen.getByTestId('mes')).toHaveTextContent(proximo);
  expect(screen.getByText('mês futuro')).toBeInTheDocument();
  expect(document.body.textContent).toContain(`Novos lançamentos vão para ${rotuloMes(proximo)}`);

  fireEvent.click(screen.getByRole('button', { name: 'Voltar para o mês atual' }));
  expect(screen.getByTestId('mes')).toHaveTextContent(atual);

  fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
  expect(screen.getByTestId('mes')).toHaveTextContent(somarMeses(atual, -1));
  expect(screen.getByText('mês passado')).toBeInTheDocument();
});

test('não deixa avançar além do limite de meses à frente', () => {
  renderizar();
  const proximo = screen.getByRole('button', { name: 'Próximo mês' });
  for (let i = 0; i < MESES_A_FRENTE; i += 1) fireEvent.click(proximo);

  expect(screen.getByTestId('mes')).toHaveTextContent(somarMeses(mesAtualISO(), MESES_A_FRENTE));
  expect(proximo).toBeDisabled();
});
