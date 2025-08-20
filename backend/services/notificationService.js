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

// Configuração do Cliente WhatsApp (se você for usar)
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

// Função para enviar email de confirmação
exports.sendEmailNotification = async (agendamento) => {
  try {
    const templatePath = path.join(__dirname, '..', process.env.TEMPLATE_DIR, 'agendamento_email.html');
    let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

    // Substituir placeholders
    htmlTemplate = htmlTemplate.replace('{{nome_paciente}}', agendamento.nome);
    htmlTemplate = htmlTemplate.replace('{{tipo_terapia}}', agendamento.tipo_terapia);
    htmlTemplate = htmlTemplate.replace('{{data_agendamento}}', new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR'));
    htmlTemplate = htmlTemplate.replace('{{hora_agendamento}}', new Date(agendamento.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    htmlTemplate = htmlTemplate.replace('{{motivo_consulta}}', agendamento.motivo_consulta);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: agendamento.email,
      subject: 'Confirmação de Agendamento',
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email de confirmação enviado com sucesso para:', agendamento.email);

  } catch (error) {
    console.error('Erro ao enviar email de confirmação:', error);
  }
};

// Função para enviar notificação pelo WhatsApp
exports.sendWhatsAppNotification = async (agendamento) => {
  if (!waClient || !waClient.isReady) {
    console.log('Cliente WhatsApp não está pronto. Ignorando notificação.');
    return;
  }

  try {
    const templatePath = path.join(__dirname, '..', process.env.TEMPLATE_DIR, 'agendamento_whatsapp.txt');
    let textTemplate = await fs.readFile(templatePath, 'utf-8');

    // Substituir placeholders
    textTemplate = textTemplate.replace('{{nome_paciente}}', agendamento.nome);
    textTemplate = textTemplate.replace('{{tipo_terapia}}', agendamento.tipo_terapia);
    textTemplate = textTemplate.replace('{{data_agendamento}}', new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR'));
    textTemplate = textTemplate.replace('{{hora_agendamento}}', new Date(agendamento.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

    // Formatar o número do telefone para o formato do WhatsApp
    const phoneNumber = `55${agendamento.telefone}@c.us`; // Adapte o formato conforme a sua necessidade

    await waClient.sendMessage(phoneNumber, textTemplate);
    console.log('Notificação WhatsApp enviada com sucesso para:', agendamento.telefone);

  } catch (error) {
    console.error('Erro ao enviar notificação WhatsApp:', error);
  }
};