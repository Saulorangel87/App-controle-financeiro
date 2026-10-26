import { hojeISO, mesAtualISO } from './datas';

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
