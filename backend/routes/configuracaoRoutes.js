const express = require('express');
const router = express.Router();
const configuracaoController = require('../controllers/configuracaoController');

// IMPORTANTE: Importe o seu middleware aqui
const authMiddleware = require('../middleware/authMiddleware'); // Ajuste o nome da pasta/arquivo se necessário



/**
 * @route   GET /api/config/minha-configuracao
 * @desc    Busca as configurações de expediente e sinal da clínica logada
 * @access  Privado (Apenas clínicas autenticadas)
 */
router.get(
  '/minha-configuracao',
  authMiddleware, // O segurança verifica aqui antes de deixar passar
  configuracaoController.getConfiguracoes
);

/**
 * @route   POST /api/config/salvar-configuracao
 * @desc    Salva ou atualiza as configurações da clínica logada
 * @access  Privado (Apenas clínicas autenticadas)
 */
router.post(
  '/salvar-configuracao',
  authMiddleware, // O segurança também protege o salvamento
  configuracaoController.updateConfiguracoes
);
/**
 * @route   GET /api/config/planos
 * @desc    Lista planos disponíveis e o plano atual da clínica logada (multitenancy)
 * @access  Privado
 */
router.get(
  '/planos',
  authMiddleware,
  configuracaoController.getPlanos
);

/**
 * @route   POST /api/config/alterar-plano
 * @desc    Valida credenciais do dono e atualiza o plano da clínica
 * @access  Privado
 */
router.post(
  '/alterar-plano',
  authMiddleware,
  configuracaoController.alterarPlano
);

module.exports = router;