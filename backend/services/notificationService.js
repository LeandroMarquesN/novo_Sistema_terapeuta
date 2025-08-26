// services/notificationService.js
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Configuração do Cliente WhatsApp
let waClient;
async function initializeWhatsAppClient() {
  waClient = new Client();

  waClient.on('qr', qr => {
    console.log('Por favor, escaneie este QR code para se conectar ao WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  waClient.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
  });

  waClient.on('auth_failure', msg => {
    console.error('Falha na autenticação do WhatsApp:', msg);
  });

  await waClient.initialize();
}

// Inicializa o cliente WhatsApp (pode ser feito uma vez na inicialização do servidor)
// initializeWhatsAppClient();

/**
 * Funcao para substituir os placeholders em um template.
 * @param {string} template - O conteúdo do template em string.
 * @param {object} data - Um objeto com os dados para substituicao.
 * @returns {string} O template com os dados substituidos.
 */
const replacePlaceholders = (template, data) => {
  let newTemplate = template;
  for (const key in data) {
    if (data[key] !== null && data[key] !== undefined) {
      newTemplate = newTemplate.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
    }
  }
  return newTemplate;
};

// =========================================================================
// FUNÇÃO ADAPTADA PARA ENVIAR E-MAIL
// Agora com suporte para reagendamento e cancelamento.
// =========================================================================
exports.sendEmailNotification = async (agendamento, isReagendamento = false, isCancelamento = false) => {
  try {
    let subject;
    let templateName;

    if (isCancelamento) {
      subject = 'Cancelamento de Agendamento';
      templateName = 'cancelamento_agendamento.html';
    } else if (isReagendamento) {
      subject = 'Confirmação de Reagendamento';
      templateName = 'reagendamento_email.html';
    } else {
      subject = 'Confirmação de Agendamento';
      templateName = 'agendamento_email.html';
    }

    const templatePath = path.join(__dirname, '..', 'templates', templateName);

    let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

    // Mapeia os dados do agendamento para os placeholders do template
    const templateData = {
      nome_paciente: agendamento.nome,
      tipo_terapia: agendamento.tipo_terapia,
      data_agendamento: new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR'),
      hora_agendamento: new Date(agendamento.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      motivo_consulta: agendamento.motivo_consulta,
      ano_atual: new Date().getFullYear(),
    };

    htmlTemplate = replacePlaceholders(htmlTemplate, templateData);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: agendamento.email,
      subject: subject,
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    const action = isCancelamento ? 'cancelamento' : (isReagendamento ? 'reagendamento' : 'confirmação');
    console.log(`Email de ${action} enviado com sucesso para:`, agendamento.email);

  } catch (error) {
    console.error(`Erro ao enviar email de ${isCancelamento ? 'cancelamento' : (isReagendamento ? 'reagendamento' : 'confirmação')}:`, error);
  }
};

// =========================================================================
// FUNÇÃO ADAPTADA PARA ENVIAR NOTIFICAÇÃO VIA WHATSAPP
// =========================================================================
exports.sendWhatsAppNotification = async (agendamento, isReagendamento = false) => {
  if (!waClient || !waClient.isReady) {
    console.log('Cliente WhatsApp não está pronto. Ignorando notificação.');
    return;
  }

  try {
    const templateName = isReagendamento ? 'reagendamento_whatsapp.txt' : 'agendamento_whatsapp.txt';
    const templatePath = path.join(__dirname, '..', 'templates', templateName); // Assumindo que os templates estão em uma pasta chamada 'templates'
    let textTemplate = await fs.readFile(templatePath, 'utf-8');

    const templateData = {
      nome_paciente: agendamento.nome,
      tipo_terapia: agendamento.tipo_terapia,
      data_agendamento: new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR'),
      hora_agendamento: new Date(agendamento.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    textTemplate = replacePlaceholders(textTemplate, templateData);

    // Formatar o número do telefone para o formato do WhatsApp
    const phoneNumber = `55${agendamento.telefone}@c.us`; // Adapte o formato conforme a sua necessidade

    await waClient.sendMessage(phoneNumber, textTemplate);
    const action = isReagendamento ? 'reagendamento' : 'confirmação';
    console.log(`Notificação WhatsApp de ${action} enviada com sucesso para:`, agendamento.telefone);

  } catch (error) {
    console.error('Erro ao enviar notificação WhatsApp:', error);
  }
};