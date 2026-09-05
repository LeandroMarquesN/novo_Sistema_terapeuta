const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiroController');
const financeiroDespesasController = require('../controllers/financeiroDespesasController');
const financeiroControllerDash = require('../controllers/financeiroControllerDash');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeFinanceiro = require('../middleware/authorize');

router.get('/lista', authMiddleware, authorizeFinanceiro, financeiroController.listar);
router.get('/resumo', authMiddleware, authorizeFinanceiro, financeiroController.getResumo);
router.get('/resumo-estrategico', authMiddleware, authorizeFinanceiro, financeiroControllerDash.getDashboardAvancado);
router.get('/lucro-real', authMiddleware, authorizeFinanceiro, financeiroControllerDash.getLucroReal);

// Fluxo de caixa
router.get('/fluxo-caixa', authMiddleware, authorizeFinanceiro, financeiroControllerDash.getFluxoCaixa);
router.post('/fluxo-caixa/email', authMiddleware, authorizeFinanceiro, financeiroControllerDash.enviarFluxoCaixaEmail);

router.get('/paciente/:pacienteId', authMiddleware, financeiroController.obterExtratoPaciente);
router.get('/recibo-dados/:pacienteId', authMiddleware, financeiroController.obterDadosRecibo);

router.post('/baixar/:id', authMiddleware, authorizeFinanceiro, financeiroController.baixar);
router.post('/cancelar/:id', authMiddleware, authorizeFinanceiro, financeiroController.cancelar);
router.post('/despesas', authMiddleware, authorizeFinanceiro, financeiroDespesasController.salvar);
router.post('/avulso', authMiddleware, authorizeFinanceiro, financeiroController.criarAvulso);
router.post('/enviar-recibo-email', authMiddleware, financeiroController.enviarReciboEmail);

module.exports = router;