// routes/marketingRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const marketingController = require('../controllers/marketingController');

router.use(auth);

router.get('/publico-alvo', marketingController.previaPublicoAlvo);
router.post('/campanhas', marketingController.criarCampanha);
router.get('/campanhas', marketingController.listarCampanhas);

module.exports = router;

// No seu app.js / server.js, registre com:
// app.use('/api/marketing', require('./routes/marketingRoutes'));
//
// E a rota que serve a página (junto das outras views EJS):
// app.get('/marketing', auth, (req, res) => res.render('marketing'));
