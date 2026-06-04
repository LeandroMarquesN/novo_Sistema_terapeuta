const express = require('express');
const router = express.Router();
const path = require('path');
const portalPacienteController = require('../controllers/portalPacienteController');
const { verificarAcessoPortal } = require('../middleware/portalPacienteMiddleware');

// Rota de entrada via Token (o link do e-mail)
router.get('/login', portalPacienteController.validarAcessoPortal);

// Rota para o JSON (Dados para o Frontend)
router.get('/api/dados', verificarAcessoPortal, portalPacienteController.getDadosPortal);

// Rota oficial do Dashboard (Renderiza o seu novo HTML elegante)
// Em portalPacienteroutes.js (ou onde estiver a rota do dashboard)
router.get('/dashboard', verificarAcessoPortal, (req, res) => {
    res.sendFile('/app/frontend/pages/portalPacienteDash.html');
});

module.exports = router;