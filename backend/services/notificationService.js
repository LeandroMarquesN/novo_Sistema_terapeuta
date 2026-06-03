// services/notificationService.js
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const notificationService = require('../services/notificationService');

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
exports.sendEmailNotification = async (clinica, agendamento, isReagendamento = false, isCancelamento = false) => {
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
      telefone_clinica: clinica.telefone_clinica,
      nome_clinica: clinica.nome_clinica,
      ano_atual: new Date().getFullYear(),
    };

    htmlTemplate = replacePlaceholders(htmlTemplate, templateData);

    // DEBUG para você ver no terminal se o e-mail chegou aqui
    console.log(`[MED-LM] Tentando enviar para: ${agendamento.email}`);

    const mailOptions = {
      from: `"MedLM - ${clinica.nome_clinica}" <${process.env.EMAIL_USER}>`,
      to: agendamento.email, // Aqui precisa ser o mesmo nome que você pós no controller
      subject: subject,
      html: htmlTemplate
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
exports.sendWhatsAppNotification = async (clinica, agendamento, isReagendamento = false) => {
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

      // Pegando da clínica vinculada:
      telefone_clinica: clinica.telefone_clinica,
      nome_clinica: clinica.nome_clinica,
      ano_atual: new Date().getFullYear()

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
// ===========================================
// FUNCAO PARA DASR bOAS VIDAS A NOVA cLINICA
// ===========================================
exports.sendWelcomeEmail = async (clinica) => {
  console.log(`[MED-LM] 📩 Iniciando processo de e-mail para: ${clinica.email_master}`);
  // ADICIONE ISSO PARA TESTAR:
  console.log("[DEBUG] Objeto recebido para e-mail:", JSON.stringify(clinica, null, 2));

  try {
    const assunto = 'Bem-vindo ao MedLM - Sua Clínica está Ativa!';
    const templatePath = path.join(__dirname, '..', 'templates', 'boas_vindas.html');
    const htmlTemplateOriginal = await fs.readFile(templatePath, 'utf-8');

    // Lógica para nome do plano amigável
    const planos = { 1: 'Trial (Até 3 membros)', 2: 'Premium (Até 10 membros)', 3: 'Enterprise (Ilimitado)' };
    const nomePlano = planos[clinica.plano_id] || 'Plano Personalizado';

    // URL do Portal e QR Code
    const urlPortal = `https://medlm.com.br/agendar/${clinica.slug}`;


    // No seu notificationService.js, altere a linha da qrCodeUrl para esta:
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlPortal)}`;

    const templateData = {
      dono_nome: clinica.dono_nome,
      nome_clinica: clinica.nome_clinica,
      email: clinica.email_master,
      senha: clinica.senha_master,
      plano_nome: nomePlano,
      url_portal: urlPortal,
      qr_code_url: qrCodeUrl,
      data_expiracao_promo: clinica.data_expiracao, // Já formatada no controller
      ano_atual: new Date().getFullYear()
    };

    const htmlFinal = replacePlaceholders(htmlTemplateOriginal, templateData);

    const mailOptions = {
      from: `"MedLM - Sistema Inteligente" <${process.env.EMAIL_USER}>`,
      to: clinica.email_master,
      subject: assunto,
      html: htmlFinal
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MED-LM] ✅ SUCESSO: E-mail enviado! ID: ${info.messageId}`);

  } catch (error) {
    console.error(`[MED-LM] ❌ ERRO NO ENVIO:`, error.message);
  }
};

// =========================================================================
// 📧 ENVIAR EXTRACTO/RECIBO FINANCEIRO POR EMAIL
// =========================================================================
exports.sendReciboEmailNotification = async (clinica, dadosEmail) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'recibo_email.html');
    let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

    // Injeta os dados mapeados utilizando o replacePlaceholders existente no seu arquivo
    htmlTemplate = replacePlaceholders(htmlTemplate, {
      nome_paciente: dadosEmail.pacienteNome,
      nome_clinica: clinica.nome_clinica,
      nome_operador: dadosEmail.operadorNome,
      data_emissao: dadosEmail.dataEmissao,
      linhas_tabela: dadosEmail.linhasHTML,
      valor_pago: dadosEmail.valorPago,
      valor_aberto: dadosEmail.valorAberto,
      qr_code_url: dadosEmail.qrCodeUrl,
      url_portal: dadosEmail.urlPortal,
      ano_atual: new Date().getFullYear()
    });

    const mailOptions = {
      from: `"MedLM - ${clinica.nome_clinica}" <${process.env.EMAIL_USER}>`,
      to: dadosEmail.pacienteEmail,
      subject: `Extrato Financeiro - ${clinica.nome_clinica}`,
      html: htmlTemplate
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MED-LM] ✅ Recibo por e-mail enviado! ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("❌ Erro no notificationService ao enviar e-mail de recibo:", error);
    throw error;
  }
};

// =========================================================================
// 📄 ENVIAR PRONTUÁRIO CLÍNICO POR EMAIL
// =========================================================================
exports.sendProntuarioEmailNotification = async (dadosProntuario) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emailProntuarioTemplate.html');
    let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

    // Substitui os placeholders do template de prontuário
    htmlTemplate = replacePlaceholders(htmlTemplate, {
      nome_paciente: dadosProntuario.nome_paciente,
      nome_profissional: dadosProntuario.nome_profissional,
      data_atendimento: dadosProntuario.data_atendimento,
      codigo_cid: dadosProntuario.codigo_cid || 'N/A',
      texto_evolucao: dadosProntuario.texto_evolucao,
      qr_code_url: dadosProntuario.qr_code_url, // URL do QR Code de validação
      ano_atual: new Date().getFullYear()
    });

    const mailOptions = {
      from: `"MedLM Clínico" <${process.env.EMAIL_USER}>`,
      to: dadosProntuario.email_paciente,
      subject: `Registro de Evolução Clínica - ${dadosProntuario.nome_paciente}`,
      html: htmlTemplate
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MED-LM] ✅ Prontuário enviado com sucesso! ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("❌ Erro no notificationService ao enviar prontuário:", error);
    throw error;
  }
};