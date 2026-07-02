const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────
// ROTA DE API (retorna JSON com os dados dos cards do dashboard)
// Montada em app.js: app.use('/api/dashboard', dashboardApiRoutes)
// Caminho final: GET /api/dashboard/estatisticas-hoje
// ─────────────────────────────────────────────────────────────
router.get('/estatisticas-hoje', authMiddleware, dashboardController.getEstatisticasHoje);

module.exports = router;