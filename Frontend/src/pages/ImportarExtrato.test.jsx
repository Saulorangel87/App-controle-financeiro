import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ImportarExtrato from './ImportarExtrato';
import { analisarOFX } from '../utils/csv';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

test('analisarOFX extrai transações SGML e XML com datas e valores corretos', () => {
  const ofx = `
OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>-45.90
<MEMO>Padaria Central
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261006000000
<TRNAMT>1500.00
<NAME>PIX Recebido
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  const itens = analisarOFX(ofx);
  expect(itens).toEqual([
    { data: '2026-10-05', descricao: 'Padaria Central', valor: -45.9 },
    { data: '2026-10-06', descricao: 'PIX Recebido', valor: 1500 },
  ]);
});

test('desmarca automaticamente lançamentos já importados ou repetidos no CSV e importa apenas os inéditos', async () => {
  api.get.mockImplementation((rota) => {
    if (rota === '/categorias') return Promise.resolve({ data: [{ id: 10, nome: 'Alimentação' }] });
    if (rota === '/despesas') {
      return Promise.resolve({
        data: [{ id: 1, descricao: 'Padaria Central', valor: 45.9, data: '2026-10-05' }],
      });
    }
    if (rota === '/entradas') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: { despesasCriadas: 1, entradasCriadas: 0 } });

  render(
    <MemoryRouter>
      <ImportarExtrato />
    </MemoryRouter>
  );

  const conteudoCSV = [
    'Data;Descrição;Valor',
    '05/10/2026;Padaria Central;-45,90',
    '06/10/2026;Supermercado;-120,00',
    '06/10/2026;Supermercado;-120,00',
  ].join('\n');

  const arquivo = {
    name: 'extrato.csv',
    text: () => Promise.resolve(conteudoCSV),
  };

  const inputArquivo = document.querySelector('#arquivo-csv');
  fireEvent.change(inputArquivo, { target: { files: [arquivo] } });

  expect(await screen.findByText('Já importado')).toBeInTheDocument();
  expect(screen.getByText('Repetido no arquivo')).toBeInTheDocument();
  expect(screen.getByText(/3 lançamentos encontrados — 1 serão importados/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Importar 1 lançamento\(s\)/i }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/importacao/extrato', {
      lancamentos: [
        {
          tipo: 'despesa',
          descricao: 'Supermercado',
          valor: 120,
          data: '2026-10-06',
          categoria_id: 10,
        },
      ],
    });
  });
});
