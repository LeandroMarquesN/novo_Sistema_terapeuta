const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');

/**
 * ROTA 1: Renderizar o Portal (Página EJS)
 * URL: seu-dominio.com/agendar/clinica-da-karla
 * O ':slug' é uma variável que o Controller usa para achar a clínica.
 */
router.get('/:slug', portalController.renderPortal);

/**
 * ROTA 2: API de Horários Disponíveis
 * URL: seu-dominio.com/api/portal/horarios?clinica_id=2&data=2026-05-15
 * Esta rota é chamada via JavaScript (fetch) dentro do portal.
 */
router.get('/api/horarios', portalController.getHorariosLivres);
router.post('/finalizar', portalController.criarAgendamento);

module.exports = router;