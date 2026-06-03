// services/auditService.js
const db = require('../config/db'); // Ajuste o caminho conforme sua estrutura

const registrarLog = async (usuarioId, prontuarioId, acao) => {
  try {
    const query = `
            INSERT INTO logs_auditoria (usuario_id, prontuario_id, acao)
            VALUES (?, ?, ?)
        `;
    await db.query(query, [usuarioId, prontuarioId, acao]);
  } catch (err) {
    // Logamos o erro mas não travamos o fluxo principal da aplicação
    console.error("⚠️ Erro crítico ao registrar auditoria:", err);
  }
};

module.exports = { registrarLog };