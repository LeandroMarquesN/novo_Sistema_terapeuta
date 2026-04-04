const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesController');

// Rotas para a tela de prontuário
router.get('/', pacientesController.listarPacientes);
router.get('/:id/prontuario', pacientesController.verProntuario);
// router.put('/:id', pacientesController.atualizarPaciente); // Para o botão Editar

module.exports = router;