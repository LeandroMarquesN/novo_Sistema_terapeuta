const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiroController');
const authMiddleware = require('../middleware/authMiddleware'); // Seu middleware de proteção
const authorizeFinanceiro = require('../middleware/authorize');

router.get('/lista', authMiddleware, authorizeFinanceiro, financeiroController.listar);
router.get('/resumo', authMiddleware, authorizeFinanceiro, financeiroController.getResumo);
router.post('/baixar/:id', authMiddleware, authorizeFinanceiro, financeiroController.baixar);

module.exports = router;