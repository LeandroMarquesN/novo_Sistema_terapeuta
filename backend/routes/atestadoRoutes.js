// routes/atestadoRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const authAtendimento = require('../middleware/authAtendimento');
const atestadoController = require('../controllers/atestadoController');

// Emitir / salvar rascunho
router.post('/salvar', authMiddleware, authAtendimento, atestadoController.salvarAtestado);

// Listar atestados de um paciente
router.get('/paciente/:pacienteId', authMiddleware, authAtendimento, atestadoController.listarAtestados);

// Detalhe completo
router.get('/detalhe/:id', authMiddleware, authAtendimento, atestadoController.obterDetalheAtestado);

// Cancelar atestado
router.put('/cancelar/:id', authMiddleware, authAtendimento, atestadoController.cancelarAtestado);

module.exports = router;