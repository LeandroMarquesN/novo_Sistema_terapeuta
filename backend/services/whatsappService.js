// services/whatsappService.js
require('dotenv').config();
const db = require('../config/db');

/**
 * Aplica settings de segurança na instância (rejectCall + groupsIgnore).
 * Chamado após create ou quando a instância já existe.
 */
async function aplicarSettingsSeguranca(instanceName, evolutionApiUrl, evolutionApiKey) {
  try {
    const res = await fetch(
      `${evolutionApiUrl}/settings/set/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey
        },
        body: JSON.stringify({
          rejectCall: true,
          msgCall: 'Não aceitamos ligações. Por favor, envie uma mensagem de texto.',
          groupsIgnore: true,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false
        })
      }
    );

    if (res.ok) {
      console.log(`[WHATSAPP] Settings de segurança aplicados em "${instanceName}" (rejectCall + groupsIgnore).`);
    } else {
      const corpo = await res.text().catch(() => '');
      console.warn(
        `[WHATSAPP] Não foi possível aplicar settings em "${instanceName}" (${res.status}): ${corpo.slice(0, 200)}`
      );
    }
  } catch (err) {
    console.warn(`[WHATSAPP] Falha ao aplicar settings de segurança: ${err.message}`);
  }
}

/**
 * Garante que a instância existe e está pronta na Evolution API.
 * Se retornar 404 ou estado fechado/inativo, cria a instância automaticamente.
 * Sempre aplica rejectCall: true e groupsIgnore: true.
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

      // Garante settings de segurança mesmo em instância já existente
      await aplicarSettingsSeguranca(instanceName, evolutionApiUrl, evolutionApiKey);

      if (state === 'open') {
        console.log(`[WHATSAPP] Instância "${instanceName}" já está open.`);
        return { ok: true, state: 'open' };
      }

      console.log(`[WHATSAPP] Instância "${instanceName}" existe mas estado="${state}". Tentando reconnect...`);
      await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { apikey: evolutionApiKey }
      }).catch(() => null);

      return { ok: true, state: state || 'connecting' };
    }

    if (stateRes.status === 404 || stateRes.status === 400) {
      console.log(`[WHATSAPP] Instância "${instanceName}" não encontrada (${stateRes.status}). Criando...`);
    } else {
      console.warn(`[WHATSAPP] connectionState retornou ${stateRes.status}. Tentando criar instância...`);
    }
  } catch (errState) {
    console.warn(`[WHATSAPP] Falha ao consultar connectionState: ${errState.message}. Tentando criar instância...`);
  }

  // 2. Cria a instância com settings de segurança
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
        integration: 'WHATSAPP-BAILEYS',
        // Segurança / anti-spam (boas práticas Evolution API)
        rejectCall: true,
        msgCall: 'Não aceitamos ligações. Por favor, envie uma mensagem de texto.',
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false
      })
    });

    if (!createRes.ok && ![403, 409].includes(createRes.status)) {
      const corpo = await createRes.text().catch(() => '');
      console.error(`[WHATSAPP] instance/create → ${createRes.status}: ${corpo}`);
      throw new Error(
        `Não foi possível criar a instância WhatsApp (${createRes.status}). ` +
        `Verifique a Evolution API e a EVOLUTION_API_KEY.`
      );
    }

    console.log(`[WHATSAPP] Instância "${instanceName}" criada/garantida com sucesso.`);

    // Aplica settings novamente (garantia extra em algumas versões da API)
    await aplicarSettingsSeguranca(instanceName, evolutionApiUrl, evolutionApiKey);

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
 * Valida se o número é de um contato privado (não grupo).
 * Rejeita JIDs de grupo (@g.us) e formatos inválidos.
 */
function validarNumeroPrivado(numero) {
  const limpo = String(numero || '').replace(/\D/g, '');

  if (!limpo || limpo.length < 10 || limpo.length > 15) {
    throw new Error('Número de telefone inválido (deve ter entre 10 e 15 dígitos).');
  }

  const original = String(numero || '').toLowerCase();
  if (
    original.includes('@g.us') ||
    original.includes('@broadcast') ||
    original.includes('status@broadcast') ||
    original.includes('@lid') ||
    /grupo|group/i.test(original)
  ) {
    throw new Error('Envio permitido apenas para números privados de clientes. Grupos não são suportados.');
  }

  return limpo;
}

/**
 * Envia mensagem de WhatsApp via Evolution API.
 * Valida créditos, garante instância, formata números (apenas privados) e abate 1 crédito após sucesso.
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

  // 2. Formatação e validação do destinatário (apenas número privado)
  let numero = validarNumeroPrivado(telefoneDestino);
  if (!numero.startsWith('55')) {
    numero = `55${numero}`;
  }

  if (numero.length < 12 || numero.length > 15) {
    throw new Error('Número de telefone inválido após formatação (esperado formato brasileiro com DDI 55).');
  }

  // 3. Personalização da mensagem (tag {{nome_paciente}})
  let textoFinal = String(mensagem || '');
  if (nomePaciente) {
    textoFinal = textoFinal.replace(/\{\{\s*nome_paciente\s*\}\}/gi, nomePaciente);
  }
  textoFinal = textoFinal
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim();

  if (!textoFinal) {
    throw new Error('Mensagem vazia após processamento.');
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

  // 4. Garante que a instância existe + aplica settings de segurança
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