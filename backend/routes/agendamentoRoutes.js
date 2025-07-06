const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const multer = require('multer');
const path = require('path');

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/', upload.single('anexo'), agendamentoController.criarAgendamento);

module.exports = router;
