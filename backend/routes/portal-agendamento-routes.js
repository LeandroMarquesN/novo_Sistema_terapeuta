// portal-agendamento-routes.js
const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const agendamentoController = require('../controllers/agendamentoController');
const portalMiddleware = require('../middleware/portalPacienteMiddleware');

// Agora, TODAS as rotas que dependem do slug passam pelo middleware
// O middleware injeta o req.clinicaId, protegendo o multi-tenancy
router.get('/:slug/api/horarios', portalMiddleware, portalController.getHorariosLivres);
router.post('/:slug/finalizar', portalMiddleware, portalController.criarAgendamento);

// Rota de Reagendamento do Portal (Blindada!)
router.put('/:slug/reagendar/:id', portalMiddleware, agendamentoController.reagendarAgendamento);

// Rota de Renderização
router.get('/:slug', portalMiddleware, portalController.renderPortal);


module.exports = router;