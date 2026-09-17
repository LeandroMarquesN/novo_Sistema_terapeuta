// routes/receitaRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const authAtendimento = require('../middleware/authAtendimento');
const receitaController = require('../controllers/receitaController');

router.post('/salvar', authMiddleware, authAtendimento, receitaController.salvarReceita);
router.get('/paciente/:pacienteId', authMiddleware, authAtendimento, receitaController.listarReceitas);
router.get('/detalhe/:id', authMiddleware, authAtendimento, receitaController.obterDetalheReceita);
router.post('/enviar-email', authMiddleware, authAtendimento, receitaController.enviarReceitaEmail);
router.post('/enviar-email', authMiddleware, authAtendimento, receitaController.enviarReceitaEmail);

module.exports = router;