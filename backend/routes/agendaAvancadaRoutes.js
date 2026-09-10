const express = require('express');
const router = express.Router();
const agendaAvancadaController = require('../controllers/agendaAvancadaController');
const authMiddleware = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────
// ROTA DE PÁGINA (renderiza a view / valida feature flag)
// Montada em app.js: app.use('/', agendaAvancadaRoutes)
// Caminho final: GET /agenda-avancada
// ─────────────────────────────────────────────────────────────
router.get('/agenda-avancada', authMiddleware, agendaAvancadaController.paginaAgendaAvancada);

module.exports = router;
