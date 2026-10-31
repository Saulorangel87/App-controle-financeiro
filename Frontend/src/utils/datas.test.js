import {
  hojeISO, mesAtualISO, somarMeses, ultimoDiaDoMes, dataPadraoDoMes, dataMaximaDoMes,
} from './datas';

describe('datas no fuso do app', () => {
  it('às 23h30 de 31/10 em Brasília ainda é 31/10, mesmo já sendo 01/11 em UTC', () => {
    const virada = new Date('2026-11-01T02:30:00Z');
    expect(hojeISO(virada)).toBe('2026-10-31');
    expect(mesAtualISO(virada)).toBe('2026-10');
  });

  it('vira o dia à meia-noite de Brasília', () => {
    expect(hojeISO(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01');
  });
});

describe('mês escolhido no seletor', () => {
  const agora = new Date('2026-10-31T15:00:00Z');

  it('soma meses atravessando o ano', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(ultimoDiaDoMes('2027-02')).toBe('2027-02-28');
  });

  it('sugere a data como se o mês tivesse virado', () => {
    expect(dataPadraoDoMes('2026-10', agora)).toBe('2026-10-31');
    expect(dataPadraoDoMes('2026-11', agora)).toBe('2026-11-01');
    expect(dataPadraoDoMes('2026-09', agora)).toBe('2026-09-30');
  });

  it('só libera data futura dentro de um mês futuro escolhido', () => {
    expect(dataMaximaDoMes('2026-10', agora)).toBe('2026-10-31');
    expect(dataMaximaDoMes('2026-09', agora)).toBe('2026-10-31');
    expect(dataMaximaDoMes('2026-11', agora)).toBe('2026-11-30');
  });
});
