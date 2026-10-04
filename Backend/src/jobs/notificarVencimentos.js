const db = require('../db');
const { enviarPush, pushConfigurado } = require('../services/push');

const TIME_ZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

function ultimoDiaDoMes(ano, mesNumero) {
  return new Date(Date.UTC(ano, mesNumero, 0)).getUTCDate();
}

function contextoHoje(agora = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(agora).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  const ano = Number(partes.year);
  const mesNumero = Number(partes.month);
  return {
    ano,
    mesNumero,
    mes: `${partes.year}-${partes.month}`,
    dia: Number(partes.day),
    ultimoDia: ultimoDiaDoMes(ano, mesNumero),
  };
}

// Próxima ocorrência do vencimento a partir de hoje: se o dia já passou neste
// mês, considera o mês seguinte. Sem isso, contas que vencem nos dias 1–3
// perdiam os avisos que caem no fim do mês anterior.
function proximoVencimento(dia, contexto) {
  const vencimentoNesteMes = Math.min(Number(dia), contexto.ultimoDia);
  if (vencimentoNesteMes >= contexto.dia) {
    return { dias: vencimentoNesteMes - contexto.dia, ano: contexto.ano, mesNumero: contexto.mesNumero, mes: contexto.mes };
  }
  const ano = contexto.mesNumero === 12 ? contexto.ano + 1 : contexto.ano;
  const mesNumero = contexto.mesNumero === 12 ? 1 : contexto.mesNumero + 1;
  const vencimento = Math.min(Number(dia), ultimoDiaDoMes(ano, mesNumero));
  return {
    dias: contexto.ultimoDia - contexto.dia + vencimento,
    ano,
    mesNumero,
    mes: `${ano}-${String(mesNumero).padStart(2, '0')}`,
  };
}

function diasAteVencimento(dia, contexto) {
  return proximoVencimento(dia, contexto).dias;
}

async function executar(agora = new Date()) {
  if (!pushConfigurado()) {
    console.log('Push não configurado; nenhum aviso enviado.');
    return 0;
  }
  const contexto = contextoHoje(agora);
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
    const vencimento = proximoVencimento(item.dia_vencimento, contexto);
    const { dias } = vencimento;
    // O "mes" do aviso é o mês do vencimento (não o de hoje), tanto pra checar
    // se já foi pago quanto pra evitar aviso duplicado.
    if (![3, 1].includes(dias) || item.pago_mes === vencimento.mes) continue;
    if (item.parcela_total && item.parcela_mes_inicio) {
      const [anoInicio, mesInicio] = item.parcela_mes_inicio.split('-').map(Number);
      const parcelaAtual = (vencimento.ano - anoInicio) * 12 + vencimento.mesNumero - mesInicio + 1;
      if (parcelaAtual > item.parcela_total) continue;
    }

    for (const inscricao of inscricoes.filter((registro) => registro.usuario_id === item.usuario_id)) {
      if (jaEnviado.get(item.usuario_id, item.id, inscricao.id, vencimento.mes, dias)) continue;
      const ok = await enviarPush(inscricao, {
        tipo: 'vencimento-recorrente',
        // Uma tag por conta: duas contas no mesmo dia não se sobrescrevem no celular.
        tag: `vencimento-recorrente-${item.id}`,
        titulo: dias === 3 ? 'Despesa vencendo em 3 dias' : 'Despesa vencendo amanhã',
        corpo: `${item.descricao} vence ${dias === 3 ? 'em 3 dias' : 'amanhã'}.`,
        url: '/recorrentes',
      });
      if (ok) {
        marcarEnviado.run(item.usuario_id, item.id, inscricao.id, vencimento.mes, dias);
        enviados += 1;
      }
    }
  }
  console.log(`Push de vencimentos: ${enviados} enviado(s).`);
  return enviados;
}

if (require.main === module) {
  executar().catch((erro) => {
    console.error('Falha no job de vencimentos:', erro);
    process.exitCode = 1;
  });
}

module.exports = { executar, contextoHoje, proximoVencimento, diasAteVencimento };
