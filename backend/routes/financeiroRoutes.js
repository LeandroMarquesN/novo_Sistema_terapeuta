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
// Rota para buscar o histórico financeiro de um paciente específico
router.get('/paciente/:pacienteId', authMiddleware, financeiroController.obterExtratoPaciente);
// Rota para buscar o histórico financeiro de um paciente específico
router.get('/paciente/:pacienteId', authMiddleware, financeiroController.obterExtratoPaciente);

// 🌟 NOVA ROTA ADICIONADA: Busca os dados auditados da clínica, operador e paciente para o recibo
router.get('/recibo-dados/:pacienteId', authMiddleware, financeiroController.obterDadosRecibo);

router.post('/baixar/:id', authMiddleware, authorizeFinanceiro, financeiroController.baixar);
router.post('/cancelar/:id', authMiddleware, authorizeFinanceiro, financeiroController.cancelar);
router.post('/despesas', authMiddleware, authorizeFinanceiro, financeiroDespesasController.salvar);
// Rota para criar um lançamento financeiro avulso para o paciente
router.post('/avulso', authMiddleware, authorizeFinanceiro, financeiroController.criarAvulso);
// Rota para disparar o envio do recibo por e-mail através do NotificationService
router.post('/enviar-recibo-email', authMiddleware, financeiroController.enviarReciboEmail);



module.exports = router;