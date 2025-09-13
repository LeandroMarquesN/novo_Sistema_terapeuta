const express = require('express');
const router = express.Router();
const exameController = require('../controllers/exameController');
const multer = require('multer');

// Configura o multer para o upload de arquivos
const upload = multer({ storage: multer.memoryStorage() });

// Define a rota POST para processar o exame.
// Usa o middleware 'upload' para tratar o arquivo antes de chamar o controlador.
router.post('/processar', upload.single('examFile'), exameController.processExam);

module.exports = router;
