const db = require('../config/db');
// controllers/marketingController.js
const marketingService = require('../services/marketingService');

// GET /api/marketing/pacientes/buscar?q=maria
exports.buscarPacientes = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const termo = (req.query.q || '').trim();
    if (termo.length < 2) return res.json([]);
    const pacientes = await marketingService.buscarPacientesPorTermo(clinicaId, termo);
    res.json(pacientes);
  } catch (err) {
    console.error('[MARKETING] Erro ao buscar pacientes:', err);
    res.status(500).json({ erro: 'Erro ao buscar pacientes.' });
  }
};

// GET /api/marketing/publico-alvo?tipoPublico=todos
// Usado pela tela pra mostrar "Esta campanha será enviada para X pacientes" ANTES de confirmar.
exports.previaPublicoAlvo = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id; // nunca confiar no body — vem do token
    const { tipoPublico = 'todos', pacienteIds, filtro } = req.query;

    const opcoesPublico = {
      pacienteIds: pacienteIds ? JSON.parse(pacienteIds) : undefined,
      filtro: filtro ? JSON.parse(filtro) : undefined,
    };

    const destinatarios = await marketingService.listarPublicoAlvo(clinicaId, tipoPublico, opcoesPublico);
    res.json({ total: destinatarios.length });
  } catch (err) {
    console.error('[MARKETING] Erro na prévia de público:', err);
    res.status(500).json({ erro: 'Erro ao calcular público-alvo.' });
  }
};

// POST /api/marketing/campanhas
// Cria a campanha e dispara o processamento em background (não bloqueia a resposta).
exports.criarCampanha = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;
    const { titulo, assunto, corpoHtml, tipoPublico, opcoesPublico } = req.body;

    if (!titulo || !assunto || !corpoHtml) {
      return res.status(400).json({ erro: 'Título, assunto e corpo do email são obrigatórios.' });
    }

    const { campanhaId, totalDestinatarios } = await marketingService.criarCampanha(clinicaId, usuarioId, {
      titulo,
      assunto,
      corpoHtml,
      tipoPublico,
      opcoesPublico,
    });

    // Dispara o processamento SEM bloquear a resposta HTTP.
    marketingService.processarCampanha(campanhaId).catch((err) =>
      console.error(`[MARKETING] Erro ao processar campanha ${campanhaId}:`, err)
    );

    res.status(201).json({ campanhaId, totalDestinatarios });
  } catch (err) {
    console.error('[MARKETING] Erro ao criar campanha:', err);
    res.status(500).json({ erro: 'Erro ao criar campanha.' });
  }
};

// GET /api/marketing/campanhas?pagina=1&porPagina=10&status=&busca=
exports.listarCampanhas = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const { pagina, porPagina, status, busca } = req.query;
    const resultado = await marketingService.listarCampanhas(clinicaId, { pagina, porPagina, status, busca });
    res.json(resultado);
  } catch (err) {
    console.error('[MARKETING] Erro ao listar campanhas:', err);
    res.status(500).json({ erro: 'Erro ao listar campanhas.' });
  }
};

exports.obterCreditosWhatsApp = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const [[clinica]] = await db.query('SELECT whatsapp_creditos FROM clinicas WHERE id = ?', [clinicaId]);

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
// Adicionar em controllers/marketingController.js
// Substituir em controllers/marketingController.js
exports.conectarInstanciaWhatsApp = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const [[clinica]] = await db.query('SELECT id, telefone_clinica, nome_clinica FROM clinicas WHERE id = ?', [clinicaId]);

    if (!clinica || !clinica.telefone_clinica) {
      return res.status(400).json({ erro: 'Cadastre o telefone oficial da clínica antes de conectar o WhatsApp.' });
    }

    const instanceName = `clinica_${clinicaId}`;
    const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'https://medlm-evolution-api.onrender.com';
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;

    if (!evolutionApiKey) {
      console.error('[MARKETING] EVOLUTION_API_KEY não está definida nas variáveis de ambiente.');
      return res.status(500).json({ erro: 'Configuração ausente: EVOLUTION_API_KEY não definida no servidor.' });
    }
    console.log(`[MARKETING] Conectando instância "${instanceName}" via ${evolutionApiUrl}`);

    // 1. Assegura que a instância existe na Evolution API
    try {
      const createRes = await fetch(`${evolutionApiUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
        body: JSON.stringify({
          instanceName,
          token: evolutionApiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });
      if (!createRes.ok && createRes.status !== 403) {
        // 403 costuma significar "instância já existe" em algumas versões da Evolution API — não é um erro fatal aqui.
        const corpoErro = await createRes.text().catch(() => '');
        console.warn(`[MARKETING] instance/create retornou ${createRes.status}: ${corpoErro}`);
      }
    } catch (errCreate) {
      console.error('[MARKETING] Falha de rede ao chamar instance/create na Evolution API:', errCreate.message);
      return res.status(502).json({ erro: `Não foi possível conectar à Evolution API em ${evolutionApiUrl}. Verifique a URL/host e se o serviço está no ar.` });
    }

    // 2. Tenta buscar o QR Code na rota de conexão
    const response = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': evolutionApiKey }
    });

    if (!response.ok) {
      const corpoErro = await response.text().catch(() => '');
      console.error(`[MARKETING] instance/connect retornou ${response.status}: ${corpoErro}`);
      return res.status(502).json({ erro: `Evolution API respondeu com erro ${response.status} ao tentar conectar.` });
    }

    const data = await response.json();

    // Varredura abrangente para capturar o base64 do QR code em qualquer variação da Evolution API
    let qrcodeBase64 = data.base64 || data.qrcode?.base64 || data.code || null;

    // Se o connect não retornou o base64 diretamente, tentamos forçar o fetch do QR code separadamente
    if (!qrcodeBase64 && (!data.instance || data.instance.state !== 'open')) {
      const qrRes = await fetch(`${evolutionApiUrl}/instance/qrCode/${instanceName}`, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey }
      }).catch((errQr) => {
        console.error('[MARKETING] Falha ao buscar /instance/qrCode:', errQr.message);
        return null;
      });

      if (qrRes && qrRes.ok) {
        const qrData = await qrRes.json();
        qrcodeBase64 = qrData.base64 || qrData.qrcode?.base64 || qrData.code || null;
      }
    }

    res.json({
      instanceName,
      qrcode: qrcodeBase64,
      status: data.instance?.state || (qrcodeBase64 ? 'connecting' : 'desconhecido')
    });
  } catch (err) {
    console.error('[MARKETING] Erro ao conectar instância:', err);
    res.status(500).json({ erro: 'Erro ao gerar QR Code do WhatsApp.' });
  }
};