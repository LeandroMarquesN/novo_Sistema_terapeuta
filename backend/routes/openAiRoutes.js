const express = require('express');
const router = express.Router();
const multer = require('multer');

// Importe o controller da OpenAI
const openAiController = require('../controllers/openAiController');

// Configura o multer para armazenar o arquivo em memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define a rota para a análise de exame
router.post('/analisar-exame', upload.single('exame_file'), openAiController.analisarExame);

// Exporte o router para ser usado no app.js
module.exports = router;
