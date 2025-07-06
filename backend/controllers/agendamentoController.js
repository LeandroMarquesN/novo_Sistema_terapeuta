const db = require('../config/db');

// Função para salvar agendamento
exports.criarAgendamento = (req, res) => {
  const {
    nome, data_nascimento, idade, peso, altura, tipo_sanguineo,
    tipo_terapia, data, motivo, origem
  } = req.body;

  let condicoes = req.body.condicoes;
  if (Array.isArray(condicoes)) {
    condicoes = condicoes.join(', ');
  } else if (typeof condicoes === 'string') {
    condicoes = condicoes;
  } else {
    condicoes = '';
  }

  const anexo = req.file ? req.file.filename : null;

  const sql = `
    INSERT INTO agendamentos
    (nome, data_nascimento, idade, peso, altura, tipo_sanguineo,
     tipo_terapia, data, motivo, origem, condicoes, anexo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const valores = [
    nome, data_nascimento, idade, peso, altura, tipo_sanguineo,
    tipo_terapia, data, motivo, origem, condicoes, anexo
  ];

  db.query(sql, valores, (err, result) => {
    if (err) {
      console.error('Erro ao salvar agendamento:', err);
      return res.status(500).json({ erro: 'Erro ao salvar agendamento' });
    }
    res.status(201).json({ mensagem: 'Agendamento salvo com sucesso!' });
  });
};
