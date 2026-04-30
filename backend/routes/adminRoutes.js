const express = require('express');
const router = express.Router();
const financeiroService = require('../services/financeiroService');
const authAdmin = require('../middleware/authAdmin');
// --- AQUI ESTAVA O ERRO 1: Faltava importar o banco de dados ---
const db = require('../config/db');

/**
 * ROTA: GET /api/admin/dashboard-dados
 */
router.get('/dashboard-dados', authAdmin, async (req, res) => {
  try {
    const dados = await financeiroService.obterRelatorioGeral();
    res.json(dados);
  } catch (error) {
    console.error("Erro na rota dashboard-dados:", error);
    res.status(500).json({ error: "Erro ao buscar panorama geral do sistema." });
  }
});

/**
 * ROTA: PATCH /api/admin/clinica/status
 */
router.patch('/clinica/status', authAdmin, async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: "ID e Status são obrigatórios." });

  try {
    const resultado = await financeiroService.alterarStatusClinica(id, status);
    res.json(resultado);
  } catch (error) {
    console.error("Erro ao alterar status da clínica:", error);
    res.status(500).json({ error: "Erro interno ao atualizar status." });
  }
});

/**
 * ROTA: POST /api/admin/financeiro/reajustar-todos
 */
router.post('/financeiro/reajustar-todos', authAdmin, async (req, res) => {
  try {
    const totalAtualizados = await financeiroService.aplicarReajustes();
    res.json({ success: true, message: "Reajuste processado.", atualizados: totalAtualizados });
  } catch (error) {
    console.error("Erro ao processar reajustes:", error);
    res.status(500).json({ error: "Erro ao processar reajuste." });
  }
});

/**
 * ROTA: PUT /api/admin/clinica/atualizar-completo
 * OBJETIVO: Atualização total via Modal de Gestão
 * --- AQUI ESTAVA O ERRO 2: Removi a duplicata e mantive a versão com segurança ---
 */
router.put('/clinica/atualizar-completo', authAdmin, async (req, res) => {
  const { id, status, plano_id, valor_atual } = req.body;

  try {
    const sql = `
      UPDATE cadastro_clinica
      SET status = ?, plano_id = ?, valor_atual = ?
      WHERE id = ?
    `;

    // O db.execute agora vai funcionar porque importamos lá no topo!
    const [result] = await db.execute(sql, [status, plano_id, valor_atual, id]);

    if (result.affectedRows > 0) {
      res.json({ success: true, message: "Clínica atualizada com sucesso!" });
    } else {
      res.status(404).json({ error: "Clínica não encontrada." });
    }
  } catch (error) {
    console.error("ERRO CRÍTICO NO BANCO:", error);
    res.status(500).json({ error: "Erro interno ao salvar no banco de dados." });
  }
});

module.exports = router;