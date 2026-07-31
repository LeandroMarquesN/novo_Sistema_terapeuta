// services/notificationService.js
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

// url do endereco em producao no render 
const APP_BASE_URL = process.env.APP_BASE_URL_ENV || "http://localhost:3000";
// Configuração da URL base do seu Portal
const URL_PORTAL_BASE = process.env.URL_PORTAL_BASE || `${APP_BASE_URL}/portal_paciente/login?token=`;

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =========================================================================
// GERENCIAMENTO DE SESSÃO WHATSAPP (BAILEYS)
// =========================================================================
let waSock = null;

/**
 * Inicializa a conexão via Baileys com reconexão automática.
 */
async function initWhatsApp() {
  // Salva os tokens de autenticação em uma pasta local (ou volume persistente)
  const authPath = path.join(__dirname, '..', 'baileys_auth_info');
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  waSock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Gera o QR Code no log do terminal (Render)
    browser: ['MedLM System', 'Chrome', '1.0.0']
  });

  // Atualização das credenciais
  waSock.ev.on('creds.update', saveCreds);

  // Monitoramento de conexão
  waSock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[MED-LM WhatsApp] Novo QR Code gerado! Verifique os logs do servidor.');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[MED-LM WhatsApp] Conexão fechada devido ao erro: ${statusCode}. Reconectando: ${shouldReconnect}`);

      if (shouldReconnect) {
        initWhatsApp(); // Tenta reconectar automaticamente
      } else {
        console.log('[MED-LM WhatsApp] Sessão encerrada/desconectada. Será necessário escaneamento manual.');
      }
    } else if (connection === 'open') {
      console.log('[MED-LM WhatsApp] ✅ Cliente WhatsApp conectado e pronto com Baileys!');
    }
  });

  return waSock;
}

// Descomente esta linha se quiser que o WhatsApp conecte automaticamente ao iniciar a aplicação:
initWhatsApp();

exports.initWhatsApp = initWhatsApp;

/**
 * Funcao para substituir os placeholders em um template.
 */
const replacePlaceholders = (template, data) => {
  let newTemplate = template;
  for (const key in data) {
    if (data[key] !== null && data[key] !== undefined) {
      newTemplate = newTemplate.split(`{{${key}}}`).join(data[key]);
    }
  }
  return newTemplate;
};

// =========================================================================
// 1. E-MAIL DE AGENDAMENTO (COM TOKEN)
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

    const linkPortal = agendamento.token_acesso ? `${URL_PORTAL_BASE}${agendamento.token_acesso}` : '#';

    const templateData = {
      nome_paciente: agendamento.nome,
      tipo_terapia: agendamento.tipo_terapia,
      data_agendamento: new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR'),
      hora_agendamento: new Date(agendamento.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      motivo_consulta: agendamento.motivo_consulta,
      telefone_clinica: clinica.telefone_clinica,
      nome_clinica: clinica.nome_clinica,
      link_portal_paciente: linkPortal,
      ano_atual: new Date().getFullYear(),
      url_portal: `${APP_BASE_URL}/agendar/${clinica.slug}`,
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${APP_BASE_URL}/agendar/${clinica.slug}`)}`,
    };

    htmlTemplate = replacePlaceholders(htmlTemplate, templateData);
    console.log(`[MED-LM] Tentando enviar para: ${agendamento.email}`);

    const mailOptions = {
      from: `"MedLM - ${clinica.nome_clinica}" <${process.env.EMAIL_USER}>`,
      to: agendamento.email,
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
// 2. WHATSAPP (MIGRADO PARA BAILEYS)
// =========================================================================
exports.sendWhatsAppNotification = async (clinica, agendamento, isReagendamento = false) => {
  // Verifica se a conexão com o WhatsApp está estabelecida
  if (!waSock || !waSock.user) {
    console.log('[MED-LM WhatsApp] Cliente não está conectado/pronto. Ignorando notificação.');
    return;
  }

  try {
    const templateName = isReagendamento ? 'reagendamento_whatsapp.txt' : 'agendamento_whatsapp.txt';
    const templatePath = path.join(__dirname, '..', 'templates', templateName);
    let textTemplate = await fs.readFile(templatePath, 'utf-8');

    const dataAgendamento = new Date(agendamento.data_agendamento);

    const templateData = {
      nome_paciente: agendamento.nome,
      tipo_terapia: agendamento.tipo_terapia,
      data_agendamento: dataAgendamento.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      hora_agendamento: dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      telefone_clinica: clinica.telefone_clinica,
      nome_clinica: clinica.nome_clinica,
      ano_atual: new Date().getFullYear(),
    };

    textTemplate = replacePlaceholders(textTemplate, templateData);

    // Sanitiza e formata o telefone para o padrão do WhatsApp do Brasil (DDI 55)
    let cleanPhone = String(agendamento.telefone).replace(/\D/g, '');

    if (!cleanPhone) {
      console.error('[MED-LM WhatsApp] Telefone do agendamento é inválido ou vazio:', agendamento.telefone);
      return;
    }

    if (!cleanPhone.startsWith('55')) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Sufixo obrigatório para números no Baileys (@s.whatsapp.net)
    const jid = `${cleanPhone}@s.whatsapp.net`;

    // Envio da mensagem via Baileys
    await waSock.sendMessage(jid, { text: textTemplate });

    const action = isReagendamento ? 'reagendamento' : 'confirmação';
    console.log(`[MED-LM WhatsApp] Notificação de ${action} enviada com sucesso para:`, cleanPhone);

  } catch (error) {
    console.error('[MED-LM WhatsApp] Erro ao enviar notificação:', error);
  }
};

// =========================================================================
// 3. BOAS VINDAS (MANTIDO)
// =========================================================================
exports.sendWelcomeEmail = async (clinica) => {
  console.log(`[MED-LM] 📩 Iniciando processo de e-mail para: ${clinica.email_master}`);
  console.log("[DEBUG] Objeto recebido para e-mail:", JSON.stringify(clinica, null, 2));
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'boas_vindas.html');
    const htmlTemplateOriginal = await fs.readFile(templatePath, 'utf-8');
    const planos = { 1: 'Trial (Até 3 membros)', 2: 'Premium (Até 10 membros)', 3: 'Enterprise (Ilimitado)' };

    const urlPortal = `${APP_BASE_URL}/agendar/${clinica.slug}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlPortal)}`;

    const templateData = {
      dono_nome: clinica.dono_nome,
      nome_clinica: clinica.nome_clinica,
      email: clinica.email_master,
      senha: clinica.senha_master,
      plano_nome: planos[clinica.plano_id] || 'Plano Personalizado',
      url_portal: urlPortal,
      qr_code_url: qrCodeUrl,
      data_expiracao: clinica.data_expiracao,
      ano_atual: new Date().getFullYear()
    };

    await transporter.sendMail({
      from: `"MedLM - Sistema Inteligente" <${process.env.EMAIL_USER}>`,
      to: clinica.email_master,
      subject: 'Bem-vindo ao MedLM',
      html: replacePlaceholders(htmlTemplateOriginal, templateData)
    });
  } catch (error) {
    console.error(`[MED-LM] ❌ ERRO NO ENVIO:`, error.message);
  }
};

// =========================================================================
// 4. RECIBO FINANCEIRO (COM TOKEN)
// =========================================================================
exports.sendReciboEmailNotification = async (clinica, dadosEmail) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'recibo_email.html');
    let htmlTemplate = await fs.readFile(templatePath, 'utf-8');
    const linkPortal = dadosEmail.token_acesso ? `${URL_PORTAL_BASE}${dadosEmail.token_acesso}` : '#';

    htmlTemplate = replacePlaceholders(htmlTemplate, {
      nome_paciente: dadosEmail.pacienteNome,
      nome_clinica: clinica.nome_clinica,
      link_portal_paciente: linkPortal,
      nome_operador: dadosEmail.operadorNome,
      data_emissao: dadosEmail.dataEmissao,
      linhas_tabela: dadosEmail.linhasHTML,
      valor_pago: dadosEmail.valorPago,
      valor_aberto: dadosEmail.valorAberto,
      qr_code_url: dadosEmail.qrCodeUrl,
      url_portal: dadosEmail.urlPortal,
      ano_atual: new Date().getFullYear()
    });

    await transporter.sendMail({
      from: `"MedLM - ${clinica.nome_clinica}" <${process.env.EMAIL_USER}>`,
      to: dadosEmail.pacienteEmail,
      subject: `Extrato Financeiro - ${clinica.nome_clinica}`,
      html: htmlTemplate
    });
    return true;
  } catch (error) {
    console.error("❌ Erro ao enviar recibo:", error);
    throw error;
  }
};

// =========================================================================
// 5. PRONTUÁRIO (COM TOKEN)
// =========================================================================
exports.sendProntuarioEmailNotification = async (dadosProntuario) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emailProntuarioTemplate.html');
    let htmlTemplate = await fs.readFile(templatePath, 'utf-8');
    const linkPortal = dadosProntuario.token_acesso ? `${URL_PORTAL_BASE}${dadosProntuario.token_acesso}` : '#';

    htmlTemplate = replacePlaceholders(htmlTemplate, {
      nome_paciente: dadosProntuario.nome_paciente,
      link_portal_paciente: linkPortal,
      nome_profissional: dadosProntuario.nome_profissional,
      data_atendimento: dadosProntuario.data_atendimento,
      codigo_cid: dadosProntuario.codigo_cid || 'N/A',
      texto_evolucao: dadosProntuario.texto_evolucao,
      qr_code_url: dadosProntuario.qr_code_url,
      ano_atual: new Date().getFullYear()
    });

    await transporter.sendMail({
      from: `"MedLM Clínico" <${process.env.EMAIL_USER}>`,
      to: dadosProntuario.email_paciente,
      subject: `Registro de Evolução Clínica - ${dadosProntuario.nome_paciente}`,
      html: htmlTemplate
    });
    return true;
  } catch (error) {
    console.error("❌ Erro ao enviar prontuário:", error);
    throw error;
  }
};

// =========================================================================
// 6. E-MAIL PROGRAMA FUNDADORES (Landing Page)
// =========================================================================
exports.sendProgramaFundadoresEmail = async (dados) => {
  console.log(`[MED-LM] 📩 Enviando confirmação de interesse para: ${dados.email}`);

  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'lading_pageTemplate.html');
    const htmlTemplate = await fs.readFile(templatePath, 'utf-8');

    const baseUrl = `${APP_BASE_URL}/pages/Cadastro_Clinica.html`;
    const linkCadastro = `${baseUrl}?origem=fundador&email=${encodeURIComponent(dados.email)}`;

    const templateData = {
      dono_nome: dados.responsavel,
      nome_clinica: dados.nome_clinica,
      ano_atual: new Date().getFullYear(),
      link_cadastro: linkCadastro
    };

    await transporter.sendMail({
      from: `"Equipe MedLM" <${process.env.EMAIL_USER}>`,
      to: dados.email,
      bcc: 'leandrommarquess.n@gmail.com',
      subject: 'Bem-vindo ao Programa Fundadores MedLM!',
      html: replacePlaceholders(htmlTemplate, templateData)
    });

    console.log(`[MED-LM] ✅ E-mail enviado. Link: ${linkCadastro}`);
  } catch (error) {
    console.error(`[MED-LM] ❌ ERRO:`, error.message);
  }
};