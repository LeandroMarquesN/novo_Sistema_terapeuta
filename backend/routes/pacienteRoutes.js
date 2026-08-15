const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesController');
const auth = require('../middleware/authMiddleware');

// Lista ativos
router.get('/', auth, pacientesController.listarPacientes);

// Lista arquivados (ANTES de rotas com :id)
router.get('/arquivados', auth, pacientesController.listarArquivados);

// Ficha / prontuário
router.get('/ficha-express/:id', auth, pacientesController.obterFichaExpressa);
router.get('/:id/prontuario', auth, pacientesController.verProntuario);

// Arquivar / Restaurar
router.patch('/:id/arquivar', auth, pacientesController.arquivarPaciente);
router.patch('/:id/restaurar', auth, pacientesController.restaurarPaciente);

// (Opcional) Hard delete — melhor não usar no fluxo normal
// router.delete('/:id', auth, pacientesController.deletarPaciente);

module.exports = router;