const express = require('express');
const router = express.Router();
const equipeController = require('../controllers/equipeController');
const authMiddleware = require('../middleware/authMiddleware'); // O SEU SEGURANÇA

// --- ROTAS PROTEGIDAS ---

// Rota: POST /api/equipe/adicionar
// Agora, só quem tem o TOKEN pode adicionar membros
router.post('/adicionar', authMiddleware, equipeController.adicionarMembro);

// Rota: GET /api/equipe/listar
// Agora, só quem tem o TOKEN pode ver a lista da equipe
router.get('/listar', authMiddleware, equipeController.listarMembros);

module.exports = router;