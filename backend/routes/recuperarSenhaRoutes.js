const express = require('express');
const router = express.Router();
const recuperarSenhaController = require('../controllers/recuperarSenhaController');

// Rotas de recuperação de senha
router.post('/forgot-password', recuperarSenhaController.forgotPassword);
router.post('/reset-password', recuperarSenhaController.resetPassword);

module.exports = router;