// controllers/marketingController.js
const db = require('../config/db');
const marketingService = require('../services/marketingService');
const whatsappService = require('../services/whatsappService');

// GET /api/marketing/pacientes/buscar?q=
exports.buscarPacientes = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const termo = (req.query.q || '').trim();

    let pacientes;
    if (termo.length === 0) {
      // Lista inicial (primeiros 20) para abrir o autocomplete
      const [rows] = await db.query(
        `SELECT id, nome, cpf, email, telefone 
         FROM pacientes 
         WHERE clinica_id = ? AND ativo = 1 
         ORDER BY nome ASC 
         LIMIT 20`,
        [clinicaId]
      );
      pacientes = rows;
    } else if (termo.length < 2) {
      return res.json([]);
    } else {
      pacientes = await marketingService.buscarPacientesPorTermo(clinicaId, termo);
    }
    res.json(pacientes);
  } catch (err) {
    console.error('[MARKETING] Erro ao buscar pacientes:', err);
    res.status(500).json({ erro: 'Erro ao buscar pacientes.' });
  }
};

// GET /api/marketing/publico-alvo
exports.previaPublicoAlvo = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const { tipoPublico = 'todos', pacienteIds, filtro, canal = 'email' } = req.query;

    const opcoesPublico = {
      pacienteIds: pacienteIds ? JSON.parse(pacienteIds) : undefined,
      filtro: filtro ? JSON.parse(filtro) : undefined,
    };

    const destinatarios = await marketingService.listarPublicoAlvo(
      clinicaId,
      tipoPublico,
      opcoesPublico,
      canal
    );
    res.json({ total: destinatarios.length });
  } catch (err) {
    console.error('[MARKETING] Erro na prévia de público:', err);
    res.status(500).json({ erro: 'Erro ao calcular público-alvo.' });
  }
};

// POST /api/marketing/campanhas
exports.criarCampanha = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;
    const {
      titulo,
      assunto,
      corpoHtml,
      tipoPublico,
      opcoesPublico,
      canal = 'email',
      rascunho = false
    } = req.body;

    if (!titulo || !corpoHtml) {
      return res.status(400).json({ erro: 'Título e corpo da mensagem são obrigatórios.' });
    }
    if (canal === 'email' && !assunto) {
      return res.status(400).json({ erro: 'Assunto do e-mail é obrigatório.' });
    }

    // Validação rápida de créditos se for WhatsApp
    if (canal === 'whatsapp' && !rascunho) {
      const [[clinica]] = await db.query(
        'SELECT whatsapp_creditos FROM clinicas WHERE id = ?',
        [clinicaId]
      );
      if (!clinica || (clinica.whatsapp_creditos || 0) <= 0) {
        return res.status(402).json({
          erro: 'Créditos de WhatsApp insuficientes. Faça uma recarga para continuar.',
          codigo: 'CREDITOS_INSUFICIENTES'
        });
      }
    }

    const { campanhaId, totalDestinatarios } = await marketingService.criarCampanha(
      clinicaId,
      usuarioId,
      {
        titulo,
        assunto: assunto || '',
        corpoHtml,
        tipoPublico,
        opcoesPublico,
        canal,
        rascunho
      }
    );

    // Processamento em background (não bloqueia a resposta HTTP)
    if (!rascunho) {
      marketingService.processarCampanha(campanhaId).catch((err) =>
        console.error(`[MARKETING] Erro ao processar campanha ${campanhaId}:`, err)
      );
    }

    res.status(201).json({ campanhaId, totalDestinatarios, canal });
  } catch (err) {
    console.error('[MARKETING] Erro ao criar campanha:', err);
    res.status(500).json({ erro: err.message || 'Erro ao criar campanha.' });
  }
};

// GET /api/marketing/campanhas
exports.listarCampanhas = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const { pagina, porPagina, status, busca } = req.query;
    const resultado = await marketingService.listarCampanhas(clinicaId, {
      pagina,
      porPagina,
      status,
      busca
    });
    res.json(resultado);
  } catch (err) {
    console.error('[MARKETING] Erro ao listar campanhas:', err);
    res.status(500).json({ erro: 'Erro ao listar campanhas.' });
  }
};

// GET /api/marketing/creditos-whatsapp
exports.obterCreditosWhatsApp = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const [[clinica]] = await db.query(
      'SELECT whatsapp_creditos FROM clinicas WHERE id = ?',
      [clinicaId]
    );

    const [[estatisticas]] = await db.query(
      `SELECT SUM(quantidade_creditos) as total_comprado_mes 
       FROM whatsapp_compras_creditos 
       WHERE clinica_id = ? AND status_pagamento = 'aprovado' AND MONTH(criado_em) = MONTH(CURDATE())`,
      [clinicaId]
    );

    res.json({
      whatsapp_creditos: clinica?.whatsapp_creditos || 0,
      total_comprado_mes: estatisticas?.total_comprado_mes || 0
    });
  } catch (err) {
    console.error('[MARKETING] Erro ao buscar créditos:', err);
    res.status(500).json({ erro: 'Erro ao buscar créditos.' });
  }
};

// GET /api/marketing/whatsapp/conectar
exports.conectarInstanciaWhatsApp = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const [[clinica]] = await db.query(
      'SELECT id, telefone_clinica, nome_clinica FROM clinicas WHERE id = ?',
      [clinicaId]
    );

    if (!clinica || !clinica.telefone_clinica) {
      return res.status(400).json({
        erro: 'Cadastre o telefone oficial da clínica antes de conectar o WhatsApp.'
      });
    }

    const instanceName = `clinica_${clinicaId}`;
    const evolutionApiUrl = (process.env.EVOLUTION_API_URL || 'https://medlm-evolution-api.onrender.com').replace(/\/$/, '');
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;

    if (!evolutionApiKey) {
      console.error('[MARKETING] EVOLUTION_API_KEY não definida.');
      return res.status(500).json({
        erro: 'Configuração ausente: EVOLUTION_API_KEY não definida no servidor.'
      });
    }

    // 1. Garante existência da instância com settings de segurança
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

      // 403 / 409 costumam significar "já existe" — ignoramos
      if (!createRes.ok && ![403, 409].includes(createRes.status)) {
        const corpoErro = await createRes.text().catch(() => '');
        console.warn(`[MARKETING] instance/create → ${createRes.status}: ${corpoErro}`);
      }
    } catch (errCreate) {
      console.error('[MARKETING] Falha de rede no create:', errCreate.message);
      return res.status(502).json({
        erro: `Não foi possível conectar à Evolution API (${evolutionApiUrl}).`
      });
    }

    // 1.1 Aplica/atualiza settings de segurança (mesmo se a instância já existia)
    try {
      await fetch(`${evolutionApiUrl}/settings/set/${instanceName}`, {
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
      });
      console.log(`[MARKETING] Settings de segurança aplicados em "${instanceName}".`);
    } catch (errSettings) {
      console.warn(`[MARKETING] Falha ao aplicar settings: ${errSettings.message}`);
    }

    // 2. Solicita conexão / QR
    const response = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { apikey: evolutionApiKey }
    });

    if (!response.ok) {
      const corpoErro = await response.text().catch(() => '');
      console.error(`[MARKETING] instance/connect → ${response.status}: ${corpoErro}`);
      return res.status(502).json({
        erro: `Evolution API respondeu com erro ${response.status}.`
      });
    }

    const data = await response.json();

    // Extrai base64 de várias formas possíveis da Evolution API
    let qrcodeBase64 = data.base64 || data.qrcode?.base64 || data.code || null;

    // Fallback extra se necessário
    if (!qrcodeBase64 && data.instance?.state !== 'open') {
      try {
        const qrRes = await fetch(`${evolutionApiUrl}/instance/qrCode/${instanceName}`, {
          method: 'GET',
          headers: { apikey: evolutionApiKey }
        });
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          qrcodeBase64 = qrData.base64 || qrData.qrcode?.base64 || qrData.code || null;
        }
      } catch (_) { }
    }

    res.json({
      instanceName,
      telefone: clinica.telefone_clinica,
      qrcode: qrcodeBase64,
      status: data.instance?.state || (qrcodeBase64 ? 'connecting' : 'open')
    });
  } catch (err) {
    console.error('[MARKETING] Erro ao conectar instância:', err);
    res.status(500).json({ erro: 'Erro ao gerar QR Code do WhatsApp.' });
  }
};

// POST /api/marketing/whatsapp/enviar (envio unitário / teste)
exports.enviarWhatsAppMarketing = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const { telefone, mensagem } = req.body;

    if (!telefone || !mensagem) {
      return res.status(400).json({ erro: 'Telefone e mensagem são obrigatórios.' });
    }

    await whatsappService.enviarWhatsApp(clinicaId, telefone, mensagem);
    res.json({ sucesso: true, mensagem: 'Mensagem enviada com sucesso!' });
  } catch (err) {
    console.error('[MARKETING] Erro ao enviar WhatsApp:', err.message);
    const status = err.message.includes('créditos') ? 402 : 500;
    res.status(status).json({
      erro: err.message || 'Erro ao enviar mensagem via WhatsApp.'
    });
  }
};