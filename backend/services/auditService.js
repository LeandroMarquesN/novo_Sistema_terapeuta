// services/auditService.js
const db = require('../config/db');

/**
 * Registra log de auditoria genérico (prontuário, receita, atestado, solicitação de exame)
 * @param {number} usuarioId 
 * @param {string} tipoDocumento - 'prontuario' | 'receita' | 'atestado' | 'solicitacao_exame'
 * @param {number} documentoId 
 * @param {string} acao 
 * @param {object} [extras] - { crm, uf_crm, prontuarioId }
 */
async function registrarLog(usuarioId, tipoDocumento, documentoId, acao, extras = {}) {
  try {
    const { crm = null, uf_crm = null, prontuarioId = null } = extras;

    // Se for prontuário antigo, mantém compatibilidade
    const prontuario_id = tipoDocumento === 'prontuario' ? documentoId : (prontuarioId || null);

    await db.query(
      `INSERT INTO logs_auditoria 
       (usuario_id, tipo_documento, documento_id, prontuario_id, acao, crm, uf_crm)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, tipoDocumento, documentoId, prontuario_id, acao, crm, uf_crm]
    );
  } catch (err) {
    console.error('[auditService] Erro ao registrar log:', err.message);
    // Não interrompe o fluxo principal
  }
}

/**
 * Versão de compatibilidade com o código antigo de prontuário
 * (prontuarioController ainda chama assim)
 */
async function registrarLogProntuario(usuarioId, prontuarioId, acao) {
  return registrarLog(usuarioId, 'prontuario', prontuarioId, acao);
}

module.exports = {
  registrarLog,
  registrarLogProntuario,
  // Mantém o nome antigo para não quebrar o prontuarioController atual
  registrarLog: async (usuarioId, documentoId, acao) => {
    // Detecta se é a chamada antiga (3 parâmetros) ou nova
    return registrarLogProntuario(usuarioId, documentoId, acao);
  }
};