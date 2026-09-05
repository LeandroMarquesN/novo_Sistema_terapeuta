// services/marketingMailerService.js
require('dotenv').config();
const nodemailer = require('nodemailer');

// -----------------------------------------------------------------------
// IMPORTANTE: este transporter é SEPARADO do usado em notificationService.js.
//
// O Gmail (EMAIL_SERVICE=gmail) continua cuidando dos emails transacionais
// (agendamento, recibo, recuperação de senha) — baixo volume, alta prioridade.
//
// Marketing em massa usa o Brevo, que é feito pra esse tipo de volume e não
// arrisca a conta do Gmail ser marcada como suspeita de spam.
//
// Variáveis novas no seu .env:
//   BREVO_SMTP_USER=seu_login_gerado_no_painel_brevo
//   BREVO_SMTP_KEY=sua_chave_smtp_gerada_no_painel_brevo
//   BREVO_REMETENTE_PADRAO=naoresponda@seudominio.com
// -----------------------------------------------------------------------

const transporterMarketing = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.BREVO_SMTP_PORT) || 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

/**
 * Envia um único email de marketing.
 * Lança erro se falhar — quem chama decide como registrar (ver marketingService.js).
 */
exports.enviarEmailMarketing = async ({ nomeClinica, destinatario, assunto, corpoHtml }) => {
  const remetente = process.env.BREVO_REMETENTE_PADRAO || process.env.EMAIL_USER;

  await transporterMarketing.sendMail({
    from: `"${nomeClinica}" <${remetente}>`,
    to: destinatario,
    subject: assunto,
    html: corpoHtml,
  });
};

exports.transporterMarketing = transporterMarketing;
