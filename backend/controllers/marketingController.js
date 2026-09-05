// controllers/marketingController.js
const marketingService = require('../services/marketingService');

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
