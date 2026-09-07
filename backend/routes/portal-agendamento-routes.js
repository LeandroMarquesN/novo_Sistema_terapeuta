// portal-agendamento-routes.js
const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController_2');
const agendamentoController = require('../controllers/agendamentoController');
const portalMiddleware = require('../middleware/portalPacienteMiddleware');

// Rota para listar os profissionais da clínica com base no slug (NOVA)
router.get('/:slug/api/usuarios', portalMiddleware, portalController.getUsuariosClinica);

// Rotas existentes do portal
router.get('/:slug/api/horarios', portalMiddleware, portalController.getHorariosLivres);
router.post('/:slug/finalizar', portalMiddleware, portalController.criarAgendamento);

// Rota de Reagendamento do Portal (Blindada!)
router.put('/:slug/reagendar/:id', portalMiddleware, agendamentoController.reagendarAgendamento);

// Rota de Renderização
router.get('/:slug', portalMiddleware, portalController.renderPortal);

module.exports = router;