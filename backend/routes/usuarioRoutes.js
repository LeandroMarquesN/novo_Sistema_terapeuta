// backend/routes/usuarioRoutes.js
const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// Criar usuário (já existente)
router.post('/', usuarioController.criarUsuario);

// Login de usuário (NOVA ROTA)
router.post('/login', usuarioController.login);

module.exports = router;
