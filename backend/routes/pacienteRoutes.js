const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesController');
// 1. Importe o middleware de autenticação (verifique o caminho correto no seu projeto)
const auth = require('../middleware/authMiddleware')

// 2. Adicione o 'auth' antes de chamar o controller
router.get('/', auth, pacientesController.listarPacientes);
router.get('/ficha-express/:id', auth, pacientesController.obterFichaExpressa);
router.get('/:id/prontuario', auth, pacientesController.verProntuario);
router.delete('/:id', auth, pacientesController.deletarPaciente);

module.exports = router;