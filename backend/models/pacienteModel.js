const db = require('../config/db');

async function getTodosPacientes() {
    const [rows] = await db.query('SELECT * FROM pacientes');
    return rows;
}

async function getPacientePorId(id) {
    const [rows] = await db.query('SELECT * FROM pacientes WHERE id = ?', [id]);
    return rows[0];
}

async function adicionarPaciente(paciente) {
    const { nome, email, telefone, data_nascimento, historico } = paciente;
    const [result] = await db.query(
        'INSERT INTO pacientes (nome, email, telefone, data_nascimento, historico) VALUES (?, ?, ?, ?, ?)',
        [nome, email, telefone, data_nascimento, historico]
    );
    return result.insertId;
}

async function atualizarPaciente(id, paciente) {
    const { nome, email, telefone, data_nascimento, historico } = paciente;
    const [result] = await db.query(
        'UPDATE pacientes SET nome = ?, email = ?, telefone = ?, data_nascimento = ?, historico = ? WHERE id = ?',
        [nome, email, telefone, data_nascimento, historico, id]
    );
    return result.affectedRows; // Retorna o número de linhas afetadas
}

async function deletarPaciente(id) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Apaga agendamentos desse paciente
        await conn.query('DELETE FROM agendamentos WHERE paciente_id = ?', [id]);

        // Apaga o paciente e captura o resultado
        const [result] = await conn.query('DELETE FROM pacientes WHERE id = ?', [id]);

        await conn.commit();
        conn.release();
        return result.affectedRows; // Retorna o número de linhas afetadas pela exclusão do paciente
    } catch (err) {
        await conn.rollback();
        conn.release();
        throw err;
    }
}

module.exports = {
    getTodosPacientes,
    getPacientePorId,
    adicionarPaciente,
    atualizarPaciente,
    deletarPaciente
};