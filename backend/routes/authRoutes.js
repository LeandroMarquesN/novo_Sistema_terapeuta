const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // <--- IMPORTE O MIDDLEWARE

// Rota: POST /api/auth/login
router.post('/login', authController.login);

// Rota de Logout - AGORA COM PROTEÇÃO
router.post('/logout', authMiddleware, (req, res) => { // <--- ADICIONE authMiddleware AQUI

  // Agora req.usuario existe porque o middleware injetou ele!
  if (req.usuario) {
    console.log(`Log: Usuário ${req.usuario.id} da clínica ${req.usuario.clinica_id} saiu.`);
  }

  res.status(200).json({
    message: "Sessão encerrada com sucesso no MedLM",
    limparLocal: true
  });
});

module.exports = router;