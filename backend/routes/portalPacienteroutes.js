const express = require('express');
const router = express.Router();
const path = require('path');
const portalPacienteController = require('../controllers/portalPacienteController');
const { verificarAcessoPortal } = require('../middleware/portalPacienteMiddleware');

// Define o caminho base do frontend (subindo 2 pastas para sair de backend/routes/)
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

router.get('/login', portalPacienteController.validarAcessoPortal);
router.get('/api/dados', verificarAcessoPortal, portalPacienteController.getDadosPortal);

// ROTA DO DASHBOARD
router.get('/dashboard', verificarAcessoPortal, (req, res) => {
    const filePath = path.join(frontendPath, 'pages', 'portalPacientesdash.html');
    res.sendFile(filePath);
});

module.exports = router;