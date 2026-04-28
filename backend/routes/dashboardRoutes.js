const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware'); // Ajustado para o nome da sua pasta

// Rota protegida: primeiro verifica o token, depois carrega o controller
router.get('/dashboard', authMiddleware, dashboardController.index);

module.exports = router;