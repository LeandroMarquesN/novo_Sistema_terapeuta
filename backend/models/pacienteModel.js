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
    return result;
}

async function deletarPaciente(id) {
    const [result] = await db.query('DELETE FROM pacientes WHERE id = ?', [id]);
    return result;
}

module.exports = {
    getTodosPacientes,
    getPacientePorId,
    adicionarPaciente,
    atualizarPaciente,
    deletarPaciente
};
