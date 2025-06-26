const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');

router.get('/', pacienteController.listarPacientes);
router.post('/', pacienteController.criarPaciente);

module.exports = router;
