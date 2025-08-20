const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController'); // Certifique-se de que este caminho está correto
const multer = require('multer');
const path = require('path');

// --- Configuração do Multer para Upload de Anexos ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// --- Definição das Rotas da API ---

// Rota POST para criar um novo agendamento.
router.post('/', upload.single('anexo'), agendamentoController.criarAgendamento);

// Rota GET para listar todos os agendamentos.
router.get('/', agendamentoController.listarAgendamentos);

// --- REMOVIDA: Rota PUT para atualizar agendamento, pois não há coluna 'anotacoes' ---
// router.put('/:id', agendamentoController.atualizarAgendamento);

// Exporta o roteador para ser usado em seu arquivo principal (ex: app.js ou server.js).
module.exports = router;