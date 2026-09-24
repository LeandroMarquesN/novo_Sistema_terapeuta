// routes/pagamentoRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // <--- ESSA IMPORTAÇÃO FALTAVA
const pagamentoController = require('../controllers/pagamentoController');

// Rota protegida para gerar o link de pagamento do Checkout Pro
router.post('/criar-preferencia', authMiddleware, pagamentoController.criarPreferenciaWhatsApp);

// Rota pública para receber o webhook do Mercado Pago
router.post('/webhook', pagamentoController.webhookMercadoPago);

// Rota de teste temporária (remova depois que testar)
router.post('/simular-teste', authMiddleware, pagamentoController.simularPagamentoTeste);

module.exports = router;