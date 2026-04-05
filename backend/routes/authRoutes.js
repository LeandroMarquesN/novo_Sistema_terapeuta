const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rota: POST /api/auth/login
// Esta rota recebe { email, senha } e devolve o Token
router.post('/login', authController.login);

module.exports = router;