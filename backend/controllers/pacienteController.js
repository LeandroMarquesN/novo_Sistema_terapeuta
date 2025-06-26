exports.getAll = (req, res) => {
  res.json({ message: 'Listar todos os pacientes' });
};

exports.create = (req, res) => {
  res.json({ message: 'Criar novo paciente' });
};
