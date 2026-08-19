

// services/auditService.js
const db = require('../config/db');

/**
 * Registra ação de auditoria com snapshot de CRM/UF do profissional.
 * Não interrompe o fluxo principal se falhar.
 */
const registrarLog = async (usuarioId, prontuarioId, acao) => {
  try {
    // Busca CRM/UF atuais do usuário (snapshot no momento da ação)
    let crm = null;
    let ufCrm = null;

    if (usuarioId) {
      const [rows] = await db.query(
        'SELECT crm, uf_crm FROM usuarios WHERE id = ? LIMIT 1',
        [usuarioId]
      );
      if (rows && rows.length > 0) {
        crm = rows[0].crm || null;
        ufCrm = rows[0].uf_crm || null;
      }
    }

    const query = `
      INSERT INTO logs_auditoria (usuario_id, prontuario_id, acao, crm, uf_crm)
      VALUES (?, ?, ?, ?, ?)
    `;
    await db.query(query, [usuarioId, prontuarioId, acao, crm, ufCrm]);

  } catch (err) {
    console.error("⚠️ Erro crítico ao registrar auditoria:", err);
  }
};

module.exports = { registrarLog };