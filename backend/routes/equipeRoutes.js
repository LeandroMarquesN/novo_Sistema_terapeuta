const express = require('express');
const router = express.Router();
const equipeController = require('../controllers/equipeController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/adicionar', authMiddleware, equipeController.adicionarMembro);
router.get('/listar', authMiddleware, equipeController.listarMembros);
router.get('/status-plano', authMiddleware, equipeController.obterStatusPlano);
router.delete('/remover/:id', authMiddleware, equipeController.removerMembro);

module.exports = router;