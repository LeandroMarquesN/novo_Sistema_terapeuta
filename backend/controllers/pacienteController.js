const pacienteModel = require('../models/pacienteModel');

exports.listarPacientes = async (req, res) => {
  try {
    const pacientes = await pacienteModel.getTodosPacientes();
    res.json(pacientes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pacientes' });
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

// exports.getAll = (req, res) => {
//   res.json({ message: 'Listar todos os pacientes' });
// };

// exports.create = (req, res) => {
//   res.json({ message: 'Criar novo paciente' });
// };
