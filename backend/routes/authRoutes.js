const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db');

// Rota: POST /api/auth/login
router.post('/login', authController.login);

// Rota de Logout - protegida
router.post('/logout', authMiddleware, async (req, res) => {

  if (req.usuario) {
    await db.execute('UPDATE usuarios SET current_session_token = NULL WHERE id = ?', [req.usuario.id]);
    console.log(`Log: Usuário ${req.usuario.id} da clínica ${req.usuario.clinica_id} saiu.`);
  }

  res.status(200).json({
    message: "Sessão encerrada com sucesso no MedLM",
    limparLocal: true
  });
});

module.exports = router;