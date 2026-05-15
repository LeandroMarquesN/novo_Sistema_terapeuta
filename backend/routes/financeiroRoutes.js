const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiroController');
const financeiroDespesasController = require('../controllers/financeiroDespesasController');
const financeiroControllerDash = require('../controllers/financeiroControllerDash');
const authMiddleware = require('../middleware/authMiddleware'); // Seu middleware de proteção
const authorizeFinanceiro = require('../middleware/authorize');

router.get('/lista', authMiddleware, authorizeFinanceiro, financeiroController.listar);
router.get('/resumo', authMiddleware, authorizeFinanceiro, financeiroController.getResumo);
router.get('/resumo-estrategico', authMiddleware, authorizeFinanceiro, financeiroControllerDash.getDashboardAvancado);

router.post('/baixar/:id', authMiddleware, authorizeFinanceiro, financeiroController.baixar);
router.post('/cancelar/:id', authMiddleware, authorizeFinanceiro, financeiroController.cancelar);
router.post('/despesas', authMiddleware, authorizeFinanceiro, financeiroDespesasController.salvar);



module.exports = router;