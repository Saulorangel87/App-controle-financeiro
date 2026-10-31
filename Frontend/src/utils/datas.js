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

// Até quantos meses à frente o seletor de mês vai (o backend aceita
// lançamentos até o fim desse mês — ver Backend/src/utils/datas.js).
export const MESES_A_FRENTE = 12;

// "YYYY-MM" somado de n meses (n pode ser negativo).
export function somarMeses(mes, n) {
  const [ano, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, numero - 1 + n, 1)).toISOString().slice(0, 7);
}

export function ultimoDiaDoMes(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  const dia = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

// Data que o formulário sugere para um lançamento no mês escolhido no
// seletor, como se o mês tivesse virado: hoje no mês corrente, o dia 1º num
// mês futuro e o último dia num mês que já passou.
export function dataPadraoDoMes(mes, agora = new Date()) {
  const mesAtual = mesAtualISO(agora);
  if (mes === mesAtual) return hojeISO(agora);
  return mes > mesAtual ? `${mes}-01` : ultimoDiaDoMes(mes);
}

// Data máxima do formulário: até hoje, como sempre — exceto com um mês
// futuro escolhido no seletor, quando vai até o fim daquele mês.
export function dataMaximaDoMes(mes, agora = new Date()) {
  return mes > mesAtualISO(agora) ? ultimoDiaDoMes(mes) : hojeISO(agora);
}

export function rotuloMes(mes) {
  return new Date(`${mes}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
