const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'Controle de Despesas <no-reply@devsaulo.com.br>';

// Envia um email via API do Resend (chamada HTTP direta — não precisa de
// biblioteca extra, o Node 20 já tem fetch global).
//
// Em ambiente sem RESEND_API_KEY configurada (dev local, testes), não falha
// nem trava o fluxo: só imprime o conteúdo no console, com o link de
// verificação/recuperação bem visível, pra dar pra testar sem precisar de
// email de verdade.
async function enviarEmail({ para, assunto, html }) {
  if (!RESEND_API_KEY) {
    console.warn(`\n[email não enviado — RESEND_API_KEY não configurada]\nPara: ${para}\nAssunto: ${assunto}\n${html}\n`);
    return;
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_REMETENTE, to: para, subject: assunto, html }),
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    console.error('Falha ao enviar email via Resend:', resposta.status, erro);
    throw new Error('Falha ao enviar email');
  }
}

function layoutEmail(titulo, mensagemHtml, linkUrl, textoBotao) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #111;">${titulo}</h2>
      <p style="color: #444; line-height: 1.5;">${mensagemHtml}</p>
      <p style="margin: 28px 0;">
        <a href="${linkUrl}" style="background: #c6ff2e; color: #111; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
          ${textoBotao}
        </a>
      </p>
      <p style="color: #888; font-size: 13px;">
        Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="${linkUrl}" style="color: #888;">${linkUrl}</a>
      </p>
      <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
        Se você não pediu isso, pode ignorar este email com segurança.
      </p>
    </div>
  `;
}

async function enviarEmailVerificacao(para, token) {
  const link = `${process.env.FRONTEND_URL}/verificar-email?token=${token}`;
  await enviarEmail({
    para,
    assunto: 'Confirme seu email — Controle de Despesas',
    html: layoutEmail(
      'Confirme seu email',
      'Falta só um passo para começar a usar o Controle de Despesas. Este link expira em 24 horas.',
      link,
      'Confirmar email'
    ),
  });
}

async function enviarEmailRecuperacaoSenha(para, token) {
  const link = `${process.env.FRONTEND_URL}/redefinir-senha?token=${token}`;
  await enviarEmail({
    para,
    assunto: 'Redefinir senha — Controle de Despesas',
    html: layoutEmail(
      'Redefinir sua senha',
      'Recebemos um pedido para redefinir sua senha. Este link expira em 1 hora.',
      link,
      'Redefinir senha'
    ),
  });
}

async function enviarEmailContaRemovida(para) {
  await enviarEmail({
    para,
    assunto: 'Sua conta foi removida por inatividade — Controle de Despesas',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #111;">Conta removida por inatividade</h2>
        <p style="color: #444; line-height: 1.5;">
          Sua conta no Controle de Despesas ficou mais de 90 dias sem login e foi
          removida, junto com todos os dados associados (despesas, categorias,
          entradas, orçamento, recorrentes e metas).
        </p>
        <p style="color: #444; line-height: 1.5;">
          Se quiser voltar a usar o app, é só criar uma conta nova quando precisar.
        </p>
      </div>
    `,
  });
}

module.exports = { enviarEmailVerificacao, enviarEmailRecuperacaoSenha, enviarEmailContaRemovida };
