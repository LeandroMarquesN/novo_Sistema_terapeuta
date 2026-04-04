const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Configuração do Multer (Upload de Arquivos) ---
// O path.join aqui sobe um nível (..) para criar a pasta na raiz do projeto
const uploadDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extname = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extname);
  }
});

const upload = multer({ storage: storage });

// Define quais campos de arquivo aceitamos
const uploadFields = upload.fields([
  { name: 'anexos', maxCount: 50 },
  { name: 'patient_photo', maxCount: 1 }
]);

// --- DEFINIÇÃO DAS ROTAS ---

// 1. Criar novo agendamento (POST) - Aceita arquivos
router.post('/', uploadFields, agendamentoController.criarAgendamento);

// 2. Listar todos os agendamentos (GET)
router.get('/', agendamentoController.listarAgendamentos);

// 3. Deletar um agendamento (DELETE)
router.delete('/:id', agendamentoController.deletarAgendamento);

// 4. Reagendar consulta (PUT) - Apenas a data (rápido)
// Ex: Usado no "Drag and Drop" do calendário ou modal simples
router.put('/:id', agendamentoController.reagendarAgendamento);

// 5. Atualização COMPLETA (PUT) - Nome, CPF, Fotos, Anexos
// Usada no botão "Editar" que abre o formulário cheio
router.put('/completo/:id', uploadFields, agendamentoController.atualizarAgendamentoCompleto);

module.exports = router;