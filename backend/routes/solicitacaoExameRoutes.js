// routes/solicitacaoExameRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const authAtendimento = require('../middleware/authAtendimento');
const solicitacaoExameController = require('../controllers/solicitacaoExameController');

// Catálogo de exames (para o frontend popular os checkboxes)
router.get('/catalogo', authMiddleware, authAtendimento, solicitacaoExameController.listarCatalogo);

// Salvar / Emitir
router.post('/salvar', authMiddleware, authAtendimento, solicitacaoExameController.salvarSolicitacao);

// Listar solicitações de um paciente
router.get('/paciente/:pacienteId', authMiddleware, authAtendimento, solicitacaoExameController.listarSolicitacoes);

// Detalhe completo
router.get('/detalhe/:id', authMiddleware, authAtendimento, solicitacaoExameController.obterDetalheSolicitacao);

// Cancelar
router.put('/cancelar/:id', authMiddleware, authAtendimento, solicitacaoExameController.cancelarSolicitacao);

module.exports = router;