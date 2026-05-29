// routes/prontuarioRoutes.js
const express = require('express');
const router = express.Router();

// 🔒 Importação dos Middlewares de Segurança
const authMiddleware = require('../middleware/authMiddleware');
const authAtendimento = require('../middleware/authAtendimento.js');

// 🎮 Importação do Novo Controller
const prontuarioController = require('../controllers/prontuarioController');

// 🏎️ ROTA PREMIUM: Limpa, segura e seguindo o padrão MVC puro
// Remova o '/prontuarios' de todas as rotas abaixo
router.post('/salvar', authMiddleware, authAtendimento, prontuarioController.salvarProntuario);
router.post('/enviar-email', authMiddleware, prontuarioController.enviarProntuarioEmail); // AQUI

router.get('/historico/:pacienteId', authMiddleware, authAtendimento, prontuarioController.listarHistorico);
router.get('/detalhe/:id', authMiddleware, authAtendimento, prontuarioController.obterDetalheProntuario);

module.exports = router;