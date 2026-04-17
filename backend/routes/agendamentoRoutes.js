const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../config/multer');

// Define quais campos de arquivo aceitamos
const uploadFields = upload.fields([
  { name: 'anexos', maxCount: 50 },
  { name: 'patient_photo', maxCount: 1 }
]);

// --- DEFINIÇÃO DAS ROTAS (Todas protegidas por authMiddleware) ---

// 1. Criar novo agendamento (POST)
// Note: O authMiddleware vem PRIMEIRO, depois o uploadFields
router.post('/', authMiddleware, uploadFields, agendamentoController.criarAgendamento);

// 2. Listar todos os agendamentos (GET)
router.get('/', authMiddleware, agendamentoController.listarAgendamentos);

// 3. Deletar um agendamento (DELETE)
router.delete('/:id', authMiddleware, agendamentoController.deletarAgendamento);

// 4. Reagendar consulta (PUT)
router.put('/:id', authMiddleware, agendamentoController.reagendarAgendamento);

// 5. Atualização COMPLETA (PUT)
router.put('/completo/:id', authMiddleware, uploadFields, agendamentoController.atualizarAgendamentoCompleto);

module.exports = router;