const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const notificacoesController = require('../controllers/notificacoesController');

router.get('/', auth, notificacoesController.listar);
router.get('/contar', auth, notificacoesController.contar);
router.patch('/:id/lida', auth, notificacoesController.marcarLida);
router.patch('/marcar-todas-lidas', auth, notificacoesController.marcarTodasLidas);

module.exports = router;