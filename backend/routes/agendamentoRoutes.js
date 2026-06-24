const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../config/multer');
const portalMiddleware = require('../middleware/portalPacienteMiddleware');

// Define quais campos de arquivo aceitamos
const uploadFields = upload.fields([
  { name: 'anexos', maxCount: 50 },
  { name: 'patient_photo', maxCount: 1 }
]);

// --- DEFINIÇÃO DAS ROTAS ---

// 1. Criar novo agendamento (POST)
router.post('/', authMiddleware, uploadFields, agendamentoController.criarAgendamento);

// 2. Listar todos os agendamentos (GET)
router.get('/', authMiddleware, agendamentoController.listarAgendamentos);

// 3. Deletar um agendamento (DELETE)
router.delete('/:id', authMiddleware, agendamentoController.deletarAgendamento);

// 4. Reagendar consulta Interna via Painel (PUT)
router.put('/:id', authMiddleware, agendamentoController.reagendarAgendamento);

// 5. Atualização COMPLETA Interna (PUT)
router.put('/completo/:id', authMiddleware, uploadFields, agendamentoController.atualizarAgendamentoCompleto);

// Detalhes do agendamento
router.get('/detalhes/:id', authMiddleware, agendamentoController.obterDetalhesAgendamento);

// Agendamentos de hoje
router.get('/hoje', authMiddleware, agendamentoController.listarAgendamentosHoje);

module.exports = router;