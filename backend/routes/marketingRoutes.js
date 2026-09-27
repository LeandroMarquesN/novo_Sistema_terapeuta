// routes/marketingRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const marketingController = require('../controllers/marketingController');

router.use(auth);

router.get('/whatsapp/conectar', marketingController.conectarInstanciaWhatsApp);
router.post('/whatsapp/enviar', marketingController.enviarWhatsAppMarketing);
router.get('/creditos-whatsapp', marketingController.obterCreditosWhatsApp);
router.get('/pacientes/buscar', marketingController.buscarPacientes);
router.get('/publico-alvo', marketingController.previaPublicoAlvo);
router.post('/campanhas', marketingController.criarCampanha);
router.get('/campanhas', marketingController.listarCampanhas);

module.exports = router;
