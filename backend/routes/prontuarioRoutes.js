// routes/prontuarioRoutes.js
const express = require('express');
const router = express.Router();

// 🔒 Importação dos Middlewares de Segurança
const authMiddleware = require('../middleware/authMiddleware');
const authAtendimento = require('../middleware/authAtendimento.js');

// 🎮 Importação do Controller
const prontuarioController = require('../controllers/prontuarioController');

// 🏎️ ROTA PREMIUM: Limpa, segura e seguindo o padrão MVC puro
router.post('/salvar', authMiddleware, authAtendimento, prontuarioController.salvarProntuario);
router.post('/enviar-email', authMiddleware, prontuarioController.enviarProntuarioEmail);

router.get('/historico/:pacienteId', authMiddleware, authAtendimento, prontuarioController.listarHistorico);
router.get('/detalhe/:id', authMiddleware, authAtendimento, prontuarioController.obterDetalheProntuario);

// 🔐 EDIÇÃO — o controller bloqueia com 403 se status_prontuario = 'finalizado'
router.put('/atualizar/:id', authMiddleware, authAtendimento, prontuarioController.atualizarProntuario);

router.get('/logs/:prontuarioId', authMiddleware, prontuarioController.listarLogs);

module.exports = router;