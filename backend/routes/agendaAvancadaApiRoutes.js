const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/agendaAvancadaController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas as rotas da API exigem autenticação
router.use(authMiddleware);

// Camada 1 — profissionais da clínica
router.get('/profissionais', ctrl.listarProfissionais);

// Camada 2 — indicadores do ano (dias com agendamento)
router.get('/indicadores-ano', ctrl.indicadoresAno);

// Camada 3 — dias do mês com contagem
router.get('/dias-mes', ctrl.diasDoMes);

// Camada 4 — grade de agendamentos por intervalo
router.get('/grade', ctrl.gradeIntervalo);

// Agendamentos de hoje (botão "Hoje")
router.get('/hoje', ctrl.agendamentosHoje);

// CRUD rápido
router.post('/agendamentos', ctrl.criarAgendamento);
router.patch('/agendamentos/:id', ctrl.atualizarAgendamento);
router.post('/agendamentos/:id/duplicar', ctrl.duplicarAgendamento);
router.delete('/agendamentos/:id', ctrl.cancelarAgendamento);

module.exports = router;
