const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');

router.get('/', pacienteController.listarPacientes);
router.get('/:id', pacienteController.buscarPaciente);
router.post('/', pacienteController.criarPaciente);
router.put('/:id', pacienteController.atualizarPaciente);
router.delete('/:id', pacienteController.deletarPaciente);

module.exports = router;
