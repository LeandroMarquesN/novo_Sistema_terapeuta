const pacienteModel = require('../models/pacienteModel');

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
