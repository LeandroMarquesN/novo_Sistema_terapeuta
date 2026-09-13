const express = require('express');
const router = express.Router();
const agendaAvancadaController = require('../controllers/agendaAvancadaController');
const authMiddleware = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────
// ROTAS DE API (retornam JSON) da Agenda Avançada
// Montada em app.js: app.use('/api/agenda-avancada', agendaAvancadaApiRoutes)
// ─────────────────────────────────────────────────────────────

// Camada 1 — profissionais da clínica
router.get('/profissionais', authMiddleware, agendaAvancadaController.listarProfissionais);

// Camada 2 — panorama anual (dias com pontinho de indicação)
router.get('/indicadores-ano', authMiddleware, agendaAvancadaController.indicadoresAno);

// Camada 3 — calendário do mês (contagem por dia)
router.get('/dias-mes', authMiddleware, agendaAvancadaController.diasDoMes);

// Camada 4 — grade de colunas (intervalo de datas)
router.get('/grade', authMiddleware, agendaAvancadaController.gradeIntervalo);

// Botão "Hoje" do rodapé fixo
router.get('/hoje', authMiddleware, agendaAvancadaController.agendamentosHoje);

// CRUD de agendamentos usado pelos modais / drag-and-drop / menu contextual
router.post('/agendamentos', authMiddleware, agendaAvancadaController.criarAgendamento);
router.patch('/agendamentos/:id', authMiddleware, agendaAvancadaController.atualizarAgendamento);
router.post('/agendamentos/:id/duplicar', authMiddleware, agendaAvancadaController.duplicarAgendamento);
router.delete('/agendamentos/:id', authMiddleware, agendaAvancadaController.cancelarAgendamento);

module.exports = router;
