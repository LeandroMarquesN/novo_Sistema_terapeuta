// services/auditService.js
const db = require('../config/db');

/**
 * Registra auditoria com snapshot de CRM/UF.
 * Se as colunas crm/uf_crm ainda não existirem, faz fallback para o INSERT antigo.
 */
const registrarLog = async (usuarioId, prontuarioId, acao) => {
  try {
    if (!usuarioId || !prontuarioId || !acao) {
      console.error('⚠️ Auditoria ignorada — parâmetros inválidos:', {
        usuarioId,
        prontuarioId,
        acao
      });
      return;
    }

    const uid = Number(usuarioId);
    const pid = Number(prontuarioId);

    // Snapshot do CRM no momento da ação
    let crm = null;
    let ufCrm = null;

    try {
      const [rows] = await db.query(
        'SELECT crm, uf_crm FROM usuarios WHERE id = ? LIMIT 1',
        [uid]
      );
      if (rows && rows.length > 0) {
        crm = rows[0].crm || null;
        ufCrm = rows[0].uf_crm || null;
      }
    } catch (e) {
      console.error('⚠️ Auditoria: falha ao buscar CRM do usuário:', e.message);
    }

    // Tenta INSERT completo (com crm / uf_crm)
    try {
      await db.query(
        `INSERT INTO logs_auditoria (usuario_id, prontuario_id, acao, crm, uf_crm)
         VALUES (?, ?, ?, ?, ?)`,
        [uid, pid, acao, crm, ufCrm]
      );
      console.log(`✅ Auditoria OK: ${acao} | user=${uid} | pront=${pid} | crm=${crm || '—'}/${ufCrm || '—'}`);
      return;
    } catch (e) {
      // Se as colunas crm/uf_crm não existirem, cai no INSERT antigo
      console.error('⚠️ INSERT com CRM falhou, tentando fallback:', e.message);
    }

    // Fallback (tabela antiga, sem crm/uf_crm)
    await db.query(
      `INSERT INTO logs_auditoria (usuario_id, prontuario_id, acao)
       VALUES (?, ?, ?)`,
      [uid, pid, acao]
    );
    console.log(`✅ Auditoria OK (fallback): ${acao} | user=${uid} | pront=${pid}`);

  } catch (err) {
    console.error('⚠️ Erro crítico ao registrar auditoria:', err.message || err);
  }
};

module.exports = { registrarLog };