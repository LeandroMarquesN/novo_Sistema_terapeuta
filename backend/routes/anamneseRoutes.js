// routes/anamneseRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const authAtendimento = require('../middleware/authAtendimento');
const anamneseController = require('../controllers/anamneseController');

router.get('/modelos', authMiddleware, authAtendimento, anamneseController.listarModelos);
router.get('/modelos/:id', authMiddleware, authAtendimento, anamneseController.obterModelo);

router.post('/salvar', authMiddleware, authAtendimento, anamneseController.salvarAnamnese);
router.put('/:id/vincular-prontuario', authMiddleware, authAtendimento, anamneseController.vincularProntuario);
router.get('/paciente/:pacienteId', authMiddleware, authAtendimento, anamneseController.listarPorPaciente);
router.get('/detalhe/:id', authMiddleware, authAtendimento, anamneseController.obterDetalhe);

module.exports = router;
