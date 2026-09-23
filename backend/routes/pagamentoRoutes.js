// routes/pagamentoRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const pagamentoController = require('../controllers/pagamentoController');

// Rota protegida por token para gerar o link de pagamento do Checkout Pro
router.post('/criar-preferencia', auth, pagamentoController.criarPreferenciaWhatsApp);

// Rota pública para receber o webhook do Mercado Pago (sem auth)
router.post('/webhook', pagamentoController.webhookMercadoPago);

module.exports = router;