// backend/routes/usuarioRoutes.js
const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
// Importe o seu middleware de autenticação se necessário (ex: const auth = require('../middlewares/auth'));

// Criar usuário
router.post('/', usuarioController.criarUsuario);

// Login de usuário
router.post('/login', usuarioController.login);

// 🌟 NOVA ROTA: Listar profissionais da clínica (certifique-se de passar o middleware de autenticação que injeta req.usuario)
router.get('/clinica', /* auth, */ usuarioController.listarUsuariosDaClinica);

module.exports = router;