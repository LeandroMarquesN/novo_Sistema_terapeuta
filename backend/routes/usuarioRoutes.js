// backend/routes/usuarioRoutes.js
const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middlewares/authMiddleware'); // 🌟 Importe o middleware de autenticação

// Criar usuário
router.post('/', usuarioController.criarUsuario);

// Login de usuário
router.post('/login', usuarioController.login);

// 🌟 ROTA CORRIGIDA: Agora o authMiddleware roda antes, injetando o req.usuario com o clinica_id correto
router.get('/clinica', authMiddleware, usuarioController.listarUsuariosDaClinica);

module.exports = router;