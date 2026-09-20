const express = require('express');
const router = express.Router();
const financeiroService = require('../services/financeiroService');
const authAdmin = require('../middleware/authAdmin');
// --- AQUI ESTAVA O ERRO 1: Faltava importar o banco de dados ---
const path = require('path');
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
  // Convertendo para Inteiro e garantindo que nunca seja NULL
  const id = parseInt(req.body.id);
  const status = req.body.status;

  // Se parseInt falhar, ele assume 1 (ID do seu plano Trial) em vez de null
  const plano_id = parseInt(req.body.plano_id) || 1;

  const valor_atual = parseFloat(req.body.valor_atual) || 0;

  try {
    const sql = `
      UPDATE clinicas
      SET status = ?, plano_id = ?, valor_atual = ?
      WHERE id = ?
    `;

    const [result] = await db.execute(sql, [status, plano_id, valor_atual, id]);

    if (result.affectedRows > 0) {
      res.json({ success: true, message: "Clínica atualizada com sucesso!" });
    } else {
      res.status(404).json({ error: "Clínica não encontrada no banco." });
    }
  } catch (error) {
    console.error("ERRO CRÍTICO NO BANCO:", error);
    res.status(500).json({ error: "Erro interno ao salvar no banco de dados." });
  }
});

/**
 * ROTA: PATCH /api/admin/clinica/email
 * OBJETIVO: Altera email_master da clínica E o email do usuário dono (cargo = 'dono')
 * Body: { id: number, email: string }
 */
router.patch('/clinica/email', authAdmin, async (req, res) => {
  const id = parseInt(req.body.id);
  const email = (req.body.email || '').trim().toLowerCase();

  if (!id || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'ID e e-mail válidos são obrigatórios.' });
  }

  try {
    // 1. E-mail já usado por OUTRA clínica?
    const [clinicasComEmail] = await db.execute(
      'SELECT id FROM clinicas WHERE email_master = ? AND id != ?',
      [email, id]
    );
    if (clinicasComEmail.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está em uso por outra clínica.' });
    }

    // 2. E-mail já usado por outro usuário (de outra clínica ou admin global)?
    const [usuariosComEmail] = await db.execute(
      'SELECT id, clinica_id FROM usuarios WHERE email = ? AND (clinica_id IS NULL OR clinica_id != ?)',
      [email, id]
    );
    if (usuariosComEmail.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário.' });
    }

    // 3. Atualiza email_master na tabela clinicas
    const [resultClinica] = await db.execute(
      'UPDATE clinicas SET email_master = ? WHERE id = ?',
      [email, id]
    );

    if (resultClinica.affectedRows === 0) {
      return res.status(404).json({ error: 'Clínica não encontrada.' });
    }

    // 4. Atualiza email do usuário DONO dessa clínica
    const [resultDono] = await db.execute(
      `UPDATE usuarios SET email = ? WHERE clinica_id = ? AND cargo = 'dono'`,
      [email, id]
    );

    return res.json({
      success: true,
      message: resultDono.affectedRows > 0
        ? 'E-mail atualizado na clínica e no usuário dono.'
        : 'E-mail atualizado na clínica. Nenhum usuário dono encontrado para sincronizar.',
      donoAtualizado: resultDono.affectedRows > 0
    });

  } catch (error) {
    console.error('Erro ao atualizar e-mail da clínica:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'E-mail duplicado. Já existe no sistema.' });
    }
    return res.status(500).json({ error: 'Erro interno ao atualizar e-mail.' });
  }
});

module.exports = router;
