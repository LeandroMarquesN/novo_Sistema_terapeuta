// services/whatsappService.js
require('dotenv').config();
const db = require('../config/db');

/**
 * Envia mensagem de WhatsApp via Evolution API.
 * Valida créditos, formata números, garante que a instância existe/está ativa e abate 1 crédito apenas após sucesso.
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

  // ─── PASSO ADICIONAL: GARANTIR QUE A INSTÂNCIA EXISTE E ESTÁ ATIVA ───
  try {
    const checkStateUrl = `${evolutionApiUrl}/instance/connectionState/${instanceName}`;
    const checkResponse = await fetch(checkStateUrl, {
      method: 'GET',
      headers: { apikey: evolutionApiKey }
    });

    // Se a instância não existe (404) ou o estado não está aberto/conectado, tentamos criá-la/inicializá-la
    if (!checkResponse.ok) {
      console.log(`[WHATSAPP] Instância ${instanceName} não encontrada ou inativa. A criar automaticamente...`);

      const createUrl = `${evolutionApiUrl}/instance/create`;
      await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey
        },
        body: JSON.stringify({
          instanceName: instanceName,
          integration: 'WHATSAPP-BAILEYS'
        })
      });
    }
  } catch (errAutoCreate) {
    console.error('[WHATSAPP] Aviso ao verificar/criar instância automaticamente:', errAutoCreate.message);
  }
  // ────────────────────────────────────────────────────────────────────

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
    console.error('[WHATSAPP] Falha de rede ao chamar Evolution API:', errFetch.message);
    throw new Error(
      `Falha de rede ao conectar na Evolution API (${evolutionApiUrl}). ` +
      `Detalhe: ${errFetch.message}.`
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