// testarBrevo.js
// Rode com: node testarBrevo.js seu-email-pessoal@gmail.com
require('dotenv').config();
const { enviarEmailMarketing } = require('./services/marketingMailerService');

const destinatario = process.argv[2];

if (!destinatario) {
  console.error('Uso: node testarBrevo.js seu-email@exemplo.com');
  process.exit(1);
}

(async () => {
  console.log(`[TESTE] Enviando email de teste para: ${destinatario}`);
  try {
    await enviarEmailMarketing({
      nomeClinica: 'MedLM - Teste',
      destinatario,
      assunto: 'Teste de envio via Brevo — MedLM',
      corpoHtml: '<p>Se você recebeu isso, o SMTP do Brevo está funcionando certinho. 🎉</p>',
    });
    console.log('[TESTE] ✅ Enviado com sucesso! Confira a caixa de entrada (e o spam, na primeira vez).');
  } catch (err) {
    console.error('[TESTE] ❌ Falhou:', err.message);
    process.exit(1);
  }
})();
