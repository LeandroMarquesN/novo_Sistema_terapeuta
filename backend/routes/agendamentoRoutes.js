const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController'); // Certifique-se de que este caminho está correto
const multer = require('multer');
const path = require('path');

// --- Configuração do Multer para Upload de Anexos ---
// Define onde os arquivos serão armazenados e como serão nomeados.
const storage = multer.diskStorage({
  // 'destination' define o diretório onde os arquivos serão salvos.
  // path.join(__dirname, '..', 'uploads') garante um caminho absoluto,
  // subindo um nível a partir da pasta 'routes' para encontrar a pasta 'uploads'.
  destination: (req, file, cb) => {
    // Certifique-se de que a pasta 'uploads' exista na raiz do seu projeto backend!
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  // 'filename' define como o arquivo será nomeado após o upload.
  // Usa um timestamp para garantir nomes únicos e mantém o nome original do arquivo.
  filename: (req, file, cb) => {
    // Ex: 1678888888888-nomeOriginal.pdf
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Inicializa o Multer com a configuração de armazenamento.
const upload = multer({ storage: storage });

// --- Definição das Rotas da API ---

// Rota POST para criar um novo agendamento.
// Usa 'upload.single('anexo')' como middleware para processar o upload de um único arquivo
// com o nome 'anexo' (que é o 'name' do input type="file" no seu HTML).
// Após o upload, a requisição é passada para agendamentoController.criarAgendamento.
router.post('/', upload.single('anexo'), agendamentoController.criarAgendamento);

// Rota GET para listar todos os agendamentos.
// Chama agendamentoController.listarAgendamentos para buscar e retornar os dados.
router.get('/', agendamentoController.listarAgendamentos);

// Exporta o roteador para ser usado em seu arquivo principal (ex: app.js ou server.js).
module.exports = router;
