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

// Substituir a função conectarInstanciaWhatsApp em controllers/marketingController.js
exports.conectarInstanciaWhatsApp = async (req, res) => {
  try {
    const clinicaId = req.usuario.clinica_id;
    const [[clinica]] = await db.query('SELECT id, telefone_clinica, nome_clinica FROM clinicas WHERE id = ?', [clinicaId]);

    if (!clinica || !clinica.telefone_clinica) {
      return res.status(400).json({ erro: 'Cadastre o telefone oficial da clínica antes de conectar o WhatsApp.' });
    }

    const instanceName = `clinica_${clinicaId}`;
    const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://167.233.99.211:8080';
    const evolutionApiKey = process.env.EVOLUTION_API_KEY || '9deee09f44ae8f7e0e65d7811d1c08a5';

    console.log(`[MARKETING] Limpando e reiniciando instância "${instanceName}" para nova conexão...`);

    // 1. Limpeza rigorosa: Tenta dar logout e deletar a instância anterior para não acumular lixo no Redis/VPS
    await fetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': evolutionApiKey }
    }).catch(() => { });

    await fetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': evolutionApiKey }
    }).catch(() => { });

    // 2. Cria uma instância totalmente nova e limpa
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

    if (!createRes.ok) {
      const errTxt = await createRes.text().catch(() => '');
      console.warn(`[MARKETING] Aviso ao criar instância: ${errTxt}`);
    }

    let qrcodeBase64 = null;
    let estadoInstancia = 'close';

    // 3. Loop rápido para capturar o QR Code recém-gerado pela Evolution API
    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2 segundos entre as tentativas

      const qrRes = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey }
      });

      if (qrRes.ok) {
        const qrData = await qrRes.json();
        qrcodeBase64 = qrData.base64 || qrData.qrcode?.base64 || qrData.code || null;
        estadoInstancia = qrData.instance?.state || qrData.state || estadoInstancia;

        if (qrcodeBase64) {
          break;
        }
      }
    }

    res.json({
      instanceName,
      telefone: clinica.telefone_clinica,
      qrcode: qrcodeBase64,
      status: estadoInstancia
    });
  } catch (err) {
    console.error('[MARKETING] Erro ao conectar instância:', err);
    res.status(500).json({ erro: 'Erro ao gerar QR Code do WhatsApp.' });
  }
};
