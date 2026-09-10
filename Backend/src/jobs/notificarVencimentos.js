const db = require('../db');
const { enviarPush, pushConfigurado } = require('../services/push');

const TIME_ZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

function contextoHoje() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  const ano = Number(partes.year);
  const mesNumero = Number(partes.month);
  return {
    ano,
    mesNumero,
    mes: `${partes.year}-${partes.month}`,
    dia: Number(partes.day),
    ultimoDia: new Date(Date.UTC(ano, mesNumero, 0)).getUTCDate(),
  };
}

function diasAteVencimento(dia, contexto) {
  return Math.min(Number(dia), contexto.ultimoDia) - contexto.dia;
}

async function executar() {
  if (!pushConfigurado()) {
    console.log('Push não configurado; nenhum aviso enviado.');
    return;
  }
  const contexto = contextoHoje();
  const recorrentes = db.prepare(`
    SELECT id, usuario_id, descricao, dia_vencimento, pago_mes,
           parcela_total, parcela_mes_inicio
    FROM despesas_recorrentes
    WHERE dia_vencimento IS NOT NULL
  `).all();
  const inscricoes = db.prepare('SELECT * FROM push_subscriptions').all();
  const jaEnviado = db.prepare(`
    SELECT 1 FROM push_notificacoes_enviadas
    WHERE usuario_id = ? AND recorrente_id = ? AND inscricao_id = ? AND mes = ? AND dias_antes = ?
  `);
  const marcarEnviado = db.prepare(`
    INSERT OR IGNORE INTO push_notificacoes_enviadas (usuario_id, recorrente_id, inscricao_id, mes, dias_antes)
    VALUES (?, ?, ?, ?, ?)
  `);
  let enviados = 0;

  for (const item of recorrentes) {
    const dias = diasAteVencimento(item.dia_vencimento, contexto);
    if (![3, 1].includes(dias) || item.pago_mes === contexto.mes) continue;
    if (item.parcela_total && item.parcela_mes_inicio) {
      const [anoInicio, mesInicio] = item.parcela_mes_inicio.split('-').map(Number);
      const parcelaAtual = (contexto.ano - anoInicio) * 12 + contexto.mesNumero - mesInicio + 1;
      if (parcelaAtual > item.parcela_total) continue;
    }

    for (const inscricao of inscricoes.filter((registro) => registro.usuario_id === item.usuario_id)) {
      if (jaEnviado.get(item.usuario_id, item.id, inscricao.id, contexto.mes, dias)) continue;
      const ok = await enviarPush(inscricao, {
        tipo: 'vencimento-recorrente',
        titulo: dias === 3 ? 'Despesa vencendo em 3 dias' : 'Despesa vencendo amanhã',
        corpo: `${item.descricao} vence ${dias === 3 ? 'em 3 dias' : 'amanhã'}.`,
        url: '/recorrentes',
      });
      if (ok) {
        marcarEnviado.run(item.usuario_id, item.id, inscricao.id, contexto.mes, dias);
        enviados += 1;
      }
    }
  }
  console.log(`Push de vencimentos: ${enviados} enviado(s).`);
}

executar().catch((erro) => {
  console.error('Falha no job de vencimentos:', erro);
  process.exitCode = 1;
});

module.exports = { contextoHoje, diasAteVencimento };
