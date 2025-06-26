const db = require('./db');

async function getTodosPacientes() {
    const [rows] = await db.query('SELECT * FROM pacientes');
    return rows;
}

async function adicionarPaciente(paciente) {
    const { nome, email, telefone, data_nascimento, historico } = paciente;
    const [result] = await db.query(
        'INSERT INTO pacientes (nome, email, telefone, data_nascimento, historico) VALUES (?, ?, ?, ?, ?)',
        [nome, email, telefone, data_nascimento, historico]
    );
    return result.insertId;
}

module.exports = { getTodosPacientes, adicionarPaciente };
