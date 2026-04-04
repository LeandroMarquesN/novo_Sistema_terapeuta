// backend/routes/equipeRoutes.js
const express = require('express');
const router = express.Router();

const equipeController = require('../controllers/equipeController');



// A rota completa será /api/equipe/adicionar
router.post('/adicionar', equipeController.adicionarMembro);

module.exports = router;