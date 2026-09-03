const db = require('../config/db');

/**
 * Cria uma notificação para a clínica
 */
async function criarNotificacao({ clinicaId, tipo, titulo, mensagem, referenciaId = null, pacienteId = null }) {
    try {
        await db.query(
            `INSERT INTO notificacoes 
       (clinica_id, tipo, titulo, mensagem, referencia_id, paciente_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
            [clinicaId, tipo, titulo, mensagem, referenciaId, pacienteId]
        );
    } catch (err) {
        console.error('Erro ao criar notificação:', err);
    }
}

/**
 * Lista notificações da clínica (mais recentes primeiro)
 */
async function listarNotificacoes(clinicaId, limite = 20) {
    const [rows] = await db.query(
        `SELECT n.*, p.nome AS nome_paciente
     FROM notificacoes n
     LEFT JOIN pacientes p ON n.paciente_id = p.id
     WHERE n.clinica_id = ?
     ORDER BY n.criado_em DESC
     LIMIT ?`,
        [clinicaId, limite]
    );
    return rows;
}

/**
 * Conta não lidas
 */
async function contarNaoLidas(clinicaId) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS total FROM notificacoes WHERE clinica_id = ? AND lida = 0`,
        [clinicaId]
    );
    return rows[0]?.total || 0;
}

/**
 * Marca uma notificação como lida
 */
async function marcarComoLida(id, clinicaId) {
    await db.query(
        `UPDATE notificacoes SET lida = 1 WHERE id = ? AND clinica_id = ?`,
        [id, clinicaId]
    );
}

/**
 * Marca todas como lidas
 */
async function marcarTodasComoLidas(clinicaId) {
    await db.query(
        `UPDATE notificacoes SET lida = 1 WHERE clinica_id = ? AND lida = 0`,
        [clinicaId]
    );
}

module.exports = {
    criarNotificacao,
    listarNotificacoes,
    contarNaoLidas,
    marcarComoLida,
    marcarTodasComoLidas
};