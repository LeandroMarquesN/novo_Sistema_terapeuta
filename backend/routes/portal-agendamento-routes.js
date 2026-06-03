const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');

// 1. PRIMEIRO: Rotas específicas (fixas)
router.get('/api/horarios', portalController.getHorariosLivres);
router.post('/finalizar', portalController.criarAgendamento);

// 2. POR ÚLTIMO: Rota dinâmica (variável)
// O Express só chegará aqui se a URL não for 'api/horarios' ou 'finalizar'
router.get('/:slug', portalController.renderPortal);

module.exports = router;