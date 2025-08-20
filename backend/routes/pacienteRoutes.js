const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');

// Rota para listar e criar pacientes (sem agendamento)
router.route('/')
  .get(pacienteController.listarPacientes)
  .post(pacienteController.criarPaciente);

// Rota para buscar, atualizar e deletar pacientes por ID
router.route('/:id')
  .get(pacienteController.buscarPaciente)
  .put(pacienteController.atualizarPaciente)
  .delete(pacienteController.deletarPaciente);

// A rota '/com-agendamento' foi removida pois a lógica correspondente
// agora reside no agendamentoController.js e sua respectiva rota.

module.exports = router;