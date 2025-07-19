const pacienteModel = require('../models/pacienteModel');
const db = require('../config/db');


exports.listarPacientes = async (req, res) => {
  try {
    const pacientes = await pacienteModel.getTodosPacientes();
    res.json(pacientes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pacientes' });
  }
};

exports.buscarPaciente = async (req, res) => {
  try {
    const paciente = await pacienteModel.getPacientePorId(req.params.id);
    if (!paciente) {
      return res.status(404).json({ erro: 'Paciente não encontrado' });
    }
    res.json(paciente);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar paciente' });
  }
};

exports.criarPaciente = async (req, res) => {
  try {
    const novoPacienteId = await pacienteModel.adicionarPaciente(req.body);
    res.status(201).json({ id: novoPacienteId });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar paciente' });
  }
};

exports.atualizarPaciente = async (req, res) => {
  try {
    await pacienteModel.atualizarPaciente(req.params.id, req.body);
    res.json({ mensagem: 'Paciente atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar paciente' });
  }
};

exports.deletarPaciente = async (req, res) => {
  try {
    await pacienteModel.deletarPaciente(req.params.id);
    res.json({ mensagem: 'Paciente deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar paciente' });
  }
};


//----ALTERAÇÃO NECESSÁRIA: adicionar criarPacienteComAgendamento no pacienteController.js

exports.criarPacienteComAgendamento = async (req, res) => {
  const {
    nome, email, telefone, data_nascimento, historico,
    data_agendamento, tipo_terapia, observacoes, status_pagamento, peso
  } = req.body;

  const conn = await db.getConnection(); // Para garantir transação segura

  try {
    await conn.beginTransaction();

    // 1. Inserir paciente
    const [pacienteResult] = await conn.query(`
      INSERT INTO pacientes (nome, email, telefone, data_nascimento, historico)
      VALUES (?, ?, ?, ?, ?)`,
      [nome, email, telefone, data_nascimento, historico]
    );

    const pacienteId = pacienteResult.insertId;

    // 2. Inserir agendamento com o paciente_id
    await conn.query(`
      INSERT INTO agendamentos (paciente_id, data, tipo_terapia, observacoes, status_pagamento, peso)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [pacienteId, data_agendamento, tipo_terapia, observacoes, status_pagamento, peso]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({ mensagem: 'Paciente e agendamento criados com sucesso!' });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar paciente e agendamento' });
  }
};

