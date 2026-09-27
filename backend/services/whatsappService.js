// services/whatsappService.js
require('dotenv').config();
const db = require('../config/db');

/**
 * Envia mensagem de WhatsApp via Evolution API.
 * Valida créditos, formata números e abate 1 crédito apenas após sucesso.
 */
exports.enviarWhatsApp = async (clinicaId, telefoneDestino, mensagem) => {
  // 1. Dados da clínica
  const [[clinica]] = await db.query(
    `SELECT whatsapp_creditos, nome_clinica, telefone_clinica 
     FROM clinicas WHERE id = ?`,
    [clinicaId]
  );

  if (!clinica) {
    throw new Error('Clínica não encontrada.');
  }

  if ((clinica.whatsapp_creditos || 0) <= 0) {
    throw new Error('Créditos de WhatsApp esgotados. Faça uma recarga para continuar.');
  }

  if (!clinica.telefone_clinica) {
    throw new Error('A clínica não possui telefone oficial cadastrado (telefone_clinica).');
  }

  // 2. Formatação do destinatário (Brasil)
  let numero = String(telefoneDestino).replace(/\D/g, '');
  if (numero.length < 10) {
    throw new Error('Número de telefone inválido.');
  }
  if (!numero.startsWith('55')) {
    numero = `55${numero}`;
  }

  const instanceName = `clinica_${clinicaId}`;
  const evolutionApiUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionApiUrl) {
    throw new Error('EVOLUTION_API_URL não configurada no servidor (.env).');
  }
  if (!evolutionApiKey) {
    throw new Error('EVOLUTION_API_KEY não configurada no servidor (.env).');
  }

  const urlEnvio = `${evolutionApiUrl}/message/sendText/${instanceName}`;

  console.log(`[WHATSAPP] Clínica ${clinica.nome_clinica} → ${numero}`);
  console.log(`[WHATSAPP] Instância: ${instanceName}`);
  console.log(`[WHATSAPP] URL: ${urlEnvio}`);

  // 3. Envio com captura detalhada de erro de rede
  let response;
  try {
    response = await fetch(urlEnvio, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionApiKey
      },
      body: JSON.stringify({
        number: numero,
        text: mensagem,
        delay: 1200
      })
    });
  } catch (errFetch) {
    // Aqui cai o "fetch failed" (DNS, timeout, SSL, firewall, host offline, etc.)
    console.error('[WHATSAPP] Falha de rede ao chamar Evolution API:', errFetch.message);
    console.error('[WHATSAPP] Stack:', errFetch.cause || errFetch.stack);
    throw new Error(
      `Falha de rede ao conectar na Evolution API (${evolutionApiUrl}). ` +
      `Detalhe: ${errFetch.message}. ` +
      `Verifique se o VPS/Hetzner está acessível, se a URL está correta (com https) e se a porta não está bloqueada.`
    );
  }

  if (!response.ok) {
    let erroMsg = `Erro na Evolution API (HTTP ${response.status})`;
    try {
      const erroData = await response.json();
      erroMsg = erroData.message || erroData.error || erroData.response?.message || erroMsg;
      console.error('[WHATSAPP] Resposta de erro da Evolution:', JSON.stringify(erroData));
    } catch (_) {
      const texto = await response.text().catch(() => '');
      if (texto) erroMsg += ` — ${texto.slice(0, 200)}`;
    }
    throw new Error(erroMsg);
  }

  // 4. Abate crédito somente após sucesso confirmado
  await db.query(
    'UPDATE clinicas SET whatsapp_creditos = GREATEST(whatsapp_creditos - 1, 0) WHERE id = ?',
    [clinicaId]
  );

  console.log(`[WHATSAPP] Enviado com sucesso. Crédito abatido (clínica ${clinicaId}).`);
  return true;
};
