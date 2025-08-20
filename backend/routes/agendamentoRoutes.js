// backend/routes/agendamentoRoutes.js

const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Configuração do Multer para Upload de Anexos ---

// Define o diretório de uploads. 'path.join' garante que o caminho seja compatível com todos os SOs.
const uploadDir = path.join(__dirname, '..', 'uploads');

// Cria o diretório de uploads se ele não existir.
// 'recursive: true' cria pastas aninhadas se necessário (útil se você tivesse subdiretórios).
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

// O nome do campo no seu formulário HTML DEVE ser 'anexos'.
// A notação '[]' no HTML (`name="anexos[]"`) já informa que é um array,
// mas o Multer espera o nome base do campo, que é 'anexos'.
// Por isso, vamos usar `multer({ storage: storage }).array('anexos')`.
const upload = multer({ storage: storage }).array('anexos');

// --- Definição das Rotas da API ---

// Rota POST para criar um novo agendamento.
// O middleware 'upload' será executado ANTES do 'agendamentoController.criarAgendamento'.
// Ele processará os arquivos enviados no campo 'anexos' e os disponibilizará em 'req.files'.
router.post('/', upload, agendamentoController.criarAgendamento);

// Rota GET para listar todos os agendamentos.
router.get('/', agendamentoController.listarAgendamentos);

// Rota DELETE para excluir um agendamento.
// Esta rota espera um ':id' na URL para identificar o agendamento a ser excluído.
router.delete('/:id', agendamentoController.deletarAgendamento);

// Exporta o roteador para ser usado em seu arquivo principal do servidor (app.js).
module.exports = router;