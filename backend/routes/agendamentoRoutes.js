const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Configuração do Multer para Upload de Anexos e Foto de Perfil ---
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

const upload = multer({ storage: storage }).fields([
  { name: 'anexos', maxCount: 50 },
  { name: 'patient_photo', maxCount: 1 }
]);

// --- Definição das Rotas da API ---

// Rota POST para criar um novo agendamento.
router.post('/', upload, agendamentoController.criarAgendamento);

// Rota GET para listar todos os agendamentos.
router.get('/', agendamentoController.listarAgendamentos);

// Rota DELETE para excluir um agendamento.
router.delete('/:id', agendamentoController.deletarAgendamento);

// ==================================================================================================
// ROTAS DE ATUALIZAÇÃO (CORRIGIDAS)
// ==================================================================================================

// Rota PUT para reagendar uma consulta (somente a data).
// Agora usa o método PUT, que é o que o seu frontend espera.
router.put('/:id', agendamentoController.reagendarAgendamento);

// Se você ainda precisar da rota de atualização completa, pode mantê-la com outro nome
// Exemplo: router.put('/completo/:id', upload, agendamentoController.atualizarAgendamentoCompleto);

// Exporta o roteador.
module.exports = router;