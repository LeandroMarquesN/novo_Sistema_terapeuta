// services/notificationService.js
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');


// NOTIFICATIONsERVICE QUE VOU USAR.   ESE ESTOU MECHENDOOOO

// url do endereco em producao no render 
const APP_BASE_URL = process.env.APP_BASE_URL_ENV || "http://localhost:3000";
// Configuração da URL base do seu Portal (Ajuste para o seu domínio real)
const URL_PORTAL_BASE = process.env.URL_PORTAL_BASE || `${APP_BASE_URL}/portal_paciente/login?token=`;

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});




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
      // Método robusto: corta o template onde encontra {{chave}} e insere o valor
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

    // Link gerado com o token recebido no objeto agendamento
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
    // DEBUG para você ver no terminal se o e-mail chegou aqui
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
// 3. BOAS VINDAS (MANTIDO)
// =========================================================================
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
    const urlPortal = `${APP_BASE_URL}/agendar/${clinica.slug}`;


    // No seu notificationService.js, altere a linha da qrCodeUrl para esta:
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlPortal)}`;


    const templateData = {
      dono_nome: clinica.dono_nome,
      nome_clinica: clinica.nome_clinica,
      email: clinica.email_master,
      senha: clinica.senha_master,
      plano_nome: planos[clinica.plano_id] || 'Plano Personalizado',
      url_portal: urlPortal,
      qr_code_url: qrCodeUrl,
      data_expiracao: clinica.data_expiracao, // <--- ADICIONE ESTA LINHA
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

    // 1. Criamos a URL com os parâmetros dinâmicos
    const baseUrl = `${APP_BASE_URL}/pages/Cadastro_Clinica.html`;
    const linkCadastro = `${baseUrl}?origem=fundador&email=${encodeURIComponent(dados.email)}`;

    // 2. Adicionamos o link no objeto de dados para o template
    const templateData = {
      dono_nome: dados.responsavel,
      nome_clinica: dados.nome_clinica,
      ano_atual: new Date().getFullYear(),
      link_cadastro: linkCadastro // <--- Nova variável para o template
    };

    // 3. Supondo que sua função replacePlaceholders faça substituições chave-valor:
    // Certifique-se de que ela suporte a substituição de '{{link_cadastro}}'
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