// "Hoje" e "mês atual" sempre no fuso do app (padrão: horário de Brasília).
// O servidor roda em UTC, então new Date().toISOString() e o 'now' do SQLite
// viram o dia às 21h em São Paulo: despesas lançadas à noite ganhavam a data
// de amanhã e, no último dia do mês, o dashboard já mostrava o mês seguinte.
//
// Timestamps (criado_em, expira_em, pago_em...) continuam em UTC — o fuso só
// importa para as datas de calendário que o usuário vê (YYYY-MM-DD / YYYY-MM).
const { mesISOValido } = require('./validacao');

const TIME_ZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

// Até quantos meses à frente o usuário pode escolher no seletor de mês e
// lançar despesas/entradas (ex: no dia 31 já lançar as contas de novembro).
const MESES_A_FRENTE = 12;

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

// Intervalo [primeiro dia de mesInicio, primeiro dia do mês seguinte a
// mesFim) em "YYYY-MM-DD", para filtrar com "data >= ? AND data < ?". Essa
// comparação usa os índices (usuario_id, data); strftime('%Y-%m', data) = ?
// obrigava o SQLite a ler todos os lançamentos do usuário.
function intervaloDosMeses(mesInicio, mesFim = mesInicio) {
  const [ano, mes] = mesFim.split('-').map(Number);
  const seguinte = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
  return [`${mesInicio}-01`, `${seguinte}-01`];
}

// "YYYY-MM" somado de n meses (n pode ser negativo).
function somarMeses(mes, n) {
  const [ano, numero] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, numero - 1 + n, 1));
  return data.toISOString().slice(0, 7);
}

function ultimoDiaDoMes(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  const dia = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

// Data mais distante aceita num lançamento: o último dia do mês mais à
// frente que o seletor de mês alcança.
function dataLimiteLancamento(agora = new Date()) {
  return ultimoDiaDoMes(somarMeses(mesAtualISO(agora), MESES_A_FRENTE));
}

// O "hoje" de um mês escolhido no seletor, como se o mês tivesse virado:
// no mês corrente é hoje; num mês futuro, o dia 1º; num mês passado, o
// último dia (o mês já fechado).
function dataReferenciaDoMes(mes, agora = new Date()) {
  const mesAtual = mesAtualISO(agora);
  if (mes === mesAtual) return hojeISO(agora);
  return mes > mesAtual ? `${mes}-01` : ultimoDiaDoMes(mes);
}

// Mês escolhido na tela (?mes=YYYY-MM) ou, sem o parâmetro, o mês corrente.
// Retorna null quando o parâmetro veio em formato inválido.
function mesDaRequisicao(req) {
  const { mes } = req.query;
  if (mes === undefined || mes === '') return mesAtualISO();
  return mesISOValido(mes) ? mes : null;
}

module.exports = {
  TIME_ZONE,
  MESES_A_FRENTE,
  hojeISO,
  mesAtualISO,
  intervaloDosMeses,
  somarMeses,
  ultimoDiaDoMes,
  dataLimiteLancamento,
  dataReferenciaDoMes,
  mesDaRequisicao,
};
