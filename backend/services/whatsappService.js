// services/whatsappService.js
require('dotenv').config();
const db = require('../config/db');

/**
 * Garante que a instância existe e está pronta na Evolution API.
 * Se retornar 404 ou estado fechado/inativo, cria a instância automaticamente.
 */
async function garantirInstancia(instanceName, evolutionApiUrl, evolutionApiKey) {
  // 1. Verifica estado da conexão
  try {
    const stateRes = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
      { method: 'GET', headers: { apikey: evolutionApiKey } }
    );

    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const state =
        stateData?.instance?.state ||
        stateData?.state ||
        stateData?.status ||
        null;

      if (state === 'open') {
        console.log(`[WHATSAPP] Instância "${instanceName}" já está open.`);
        return { ok: true, state: 'open' };
      }

      console.log(`[WHATSAPP] Instância "${instanceName}" existe mas estado="${state}". Tentando reconnect...`);
      // Tenta reconnect (gera QR se necessário — o envio ainda pode falhar até escanear)
      await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { apikey: evolutionApiKey }
      }).catch(() => null);

      return { ok: true, state: state || 'connecting' };
    }

    // 404 ou outro erro → tenta criar
    if (stateRes.status === 404 || stateRes.status === 400) {
      console.log(`[WHATSAPP] Instância "${instanceName}" não encontrada (${stateRes.status}). Criando...`);
    } else {
      console.warn(`[WHATSAPP] connectionState retornou ${stateRes.status}. Tentando criar instância...`);
    }
  } catch (errState) {
    console.warn(`[WHATSAPP] Falha ao consultar connectionState: ${errState.message}. Tentando criar instância...`);
  }

  // 2. Cria a instância
  try {
    const createRes = await fetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionApiKey
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });

    // 403/409 costumam significar "já existe"
    if (!createRes.ok && ![403, 409].includes(createRes.status)) {
      const corpo = await createRes.text().catch(() => '');
      console.error(`[WHATSAPP] instance/create → ${createRes.status}: ${corpo}`);
      throw new Error(
        `Não foi possível criar a instância WhatsApp (${createRes.status}). ` +
        `Verifique a Evolution API e a EVOLUTION_API_KEY.`
      );
    }

    console.log(`[WHATSAPP] Instância "${instanceName}" criada/garantida com sucesso.`);

    // Solicita connect para gerar QR / iniciar sessão
    await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { apikey: evolutionApiKey }
    }).catch(() => null);

    return { ok: true, state: 'created' };
  } catch (errCreate) {
    console.error('[WHATSAPP] Erro ao criar instância:', errCreate.message);
    throw new Error(
      `Falha ao garantir instância WhatsApp "${instanceName}": ${errCreate.message}`
    );
  }
}

/**
 * Envia mensagem de WhatsApp via Evolution API.
 * Valida créditos, garante instância, formata números e abate 1 crédito após sucesso.
 *
 * @param {number} clinicaId
 * @param {string} telefoneDestino
 * @param {string} mensagem
 * @param {string|null} nomePaciente - se informado, substitui {{nome_paciente}} no texto
 */
exports.enviarWhatsApp = async (clinicaId, telefoneDestino, mensagem, nomePaciente = null) => {
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

  // 3. Personalização da mensagem (tag {{nome_paciente}})
  let textoFinal = String(mensagem || '');
  if (nomePaciente) {
    textoFinal = textoFinal.replace(/\{\{\s*nome_paciente\s*\}\}/gi, nomePaciente);
  }
  // Remove HTML residual caso venha do editor
  textoFinal = textoFinal
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim();

  const instanceName = `clinica_${clinicaId}`;
  const evolutionApiUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionApiUrl) {
    throw new Error('EVOLUTION_API_URL não configurada no servidor (.env).');
  }
  if (!evolutionApiKey) {
    throw new Error('EVOLUTION_API_KEY não configurada no servidor (.env).');
  }

  // 4. Garante que a instância existe (cria se 404 / inativa)
  await garantirInstancia(instanceName, evolutionApiUrl, evolutionApiKey);

  const urlEnvio = `${evolutionApiUrl}/message/sendText/${instanceName}`;

  console.log(`[WHATSAPP] Clínica ${clinica.nome_clinica} → ${numero}`);
  console.log(`[WHATSAPP] Instância: ${instanceName}`);
  console.log(`[WHATSAPP] URL: ${urlEnvio}`);

  // 5. Envio
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
        text: textoFinal,
        delay: 1200
      })
    });
  } catch (errFetch) {
    console.error('[WHATSAPP] Falha de rede ao chamar Evolution API:', errFetch.message);
    throw new Error(
      `Falha de rede ao conectar na Evolution API (${evolutionApiUrl}). ` +
      `Detalhe: ${errFetch.message}. ` +
      `Verifique se o VPS está acessível e se EVOLUTION_API_URL / porta estão corretas.`
    );
  }

  // Se a API respondeu 404 no sendText, tenta recriar e reenviar uma vez
  if (response.status === 404) {
    console.warn('[WHATSAPP] sendText retornou 404. Recriando instância e tentando de novo...');
    await garantirInstancia(instanceName, evolutionApiUrl, evolutionApiKey);

    try {
      response = await fetch(urlEnvio, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey
        },
        body: JSON.stringify({
          number: numero,
          text: textoFinal,
          delay: 1200
        })
      });
    } catch (errRetry) {
      throw new Error(
        `Falha de rede no reenvio após recriar instância: ${errRetry.message}`
      );
    }
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

  // 6. Abate crédito somente após sucesso
  await db.query(
    'UPDATE clinicas SET whatsapp_creditos = GREATEST(whatsapp_creditos - 1, 0) WHERE id = ?',
    [clinicaId]
  );

  console.log(`[WHATSAPP] Enviado com sucesso. Crédito abatido (clínica ${clinicaId}).`);
  return true;
};
