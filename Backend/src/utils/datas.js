// "Hoje" e "mês atual" sempre no fuso do app (padrão: horário de Brasília).
// O servidor roda em UTC, então new Date().toISOString() e o 'now' do SQLite
// viram o dia às 21h em São Paulo: despesas lançadas à noite ganhavam a data
// de amanhã e, no último dia do mês, o dashboard já mostrava o mês seguinte.
//
// Timestamps (criado_em, expira_em, pago_em...) continuam em UTC — o fuso só
// importa para as datas de calendário que o usuário vê (YYYY-MM-DD / YYYY-MM).
const TIME_ZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

// Data de calendário (YYYY-MM-DD) de um instante, no fuso do app.
function hojeISO(agora = new Date()) {
  const partes = Object.fromEntries(
    formatador.formatToParts(agora)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value])
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function mesAtualISO(agora = new Date()) {
  return hojeISO(agora).slice(0, 7);
}

module.exports = { TIME_ZONE, hojeISO, mesAtualISO };
