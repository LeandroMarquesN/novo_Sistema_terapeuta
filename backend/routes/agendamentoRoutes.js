// backend/routes/agendamentoRoutes.js

const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Configuração do Multer para Upload de Anexos e Foto de Perfil ---

// Define o diretório de uploads. 'path.join' garante que o caminho seja compatível com todos os SOs.
const uploadDir = path.join(__dirname, '..', 'uploads');

// Cria o diretório de uploads se ele não existir.
// 'recursive: true' cria pastas aninhadas se necessário.
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  // Define a pasta de destino para os arquivos carregados
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  // Define o nome do arquivo no servidor
  filename: (req, file, cb) => {
    // Gera um nome de arquivo único para evitar colisões
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Extrai a extensão do nome do arquivo original
    const extname = path.extname(file.originalname);
    // Cria um novo nome de arquivo combinando o nome do campo, sufixo único e extensão original
    cb(null, file.fieldname + '-' + uniqueSuffix + extname);
  }
});

// A diferença crucial: usamos .fields() para lidar com múltiplos campos de arquivo.
// O array de objetos especifica o nome de cada campo do formulário e o número máximo de arquivos.
const upload = multer({ storage: storage }).fields([
  { name: 'anexos', maxCount: 50 },
  { name: 'patient_photo', maxCount: 1 }
]);

// --- Definição das Rotas da API ---

// Rota POST para criar um novo agendamento.
// O middleware 'upload' (agora configurado para campos múltiplos)
// será executado ANTES do 'agendamentoController.criarAgendamento'.
router.post('/', upload, agendamentoController.criarAgendamento);

// Rota GET para listar todos os agendamentos.
router.get('/', agendamentoController.listarAgendamentos);

// Rota DELETE para excluir um agendamento.
// Esta rota espera um ':id' na URL para identificar o agendamento a ser excluído.
router.delete('/:id', agendamentoController.deletarAgendamento);

// ==================================================================================================
// NOVA ROTA: Rota PUT para reagendar uma consulta.
// ==================================================================================================
// Esta rota espera um ':id' na URL para identificar qual agendamento deve ser atualizado.
// Ela utiliza o mesmo middleware 'upload' para lidar com possíveis novos arquivos ou foto.
// O controlador 'reagendarAgendamento' será responsável por atualizar o agendamento no DB
// e enviar a notificação de reagendamento.
router.put('/:id', upload, agendamentoController.reagendarAgendamento);

// Exporta o roteador para ser usado em seu arquivo principal do servidor (app.js).
module.exports = router;