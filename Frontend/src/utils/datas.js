// "Hoje" e "mês atual" no mesmo fuso que o backend usa para validar datas
// (APP_TIMEZONE, padrão America/Sao_Paulo). toISOString() é sempre UTC: às
// 21h em Brasília já devolvia o dia seguinte, e o formulário vinha com a data
// de amanhã. O fuso é fixo (e não o do navegador) para o "hoje" da tela nunca
// divergir do "hoje" que o backend aceita, mesmo com o usuário viajando.
export const FUSO_APP = 'America/Sao_Paulo';

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_APP, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function hojeISO(agora = new Date()) {
  const partes = Object.fromEntries(
    formatador.formatToParts(agora)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value])
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function mesAtualISO(agora = new Date()) {
  return hojeISO(agora).slice(0, 7);
}
