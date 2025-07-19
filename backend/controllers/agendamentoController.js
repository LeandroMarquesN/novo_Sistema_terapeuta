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
      console.error('Erro ao salvar agendamento precisa resolver leandro:', err);
      return res.status(500).json({ erro: 'Erro ao salvar agendamento' });
    }
    res.status(201).json({ mensagem: 'Agendamento salvo com sucesso!' });
  });
};

//-------------- Função para retornar os agendamentos----------.

exports.listarAgendamentos = (req, res) => {
  const sql = `
    SELECT id, data, tipo_terapia, nome
    FROM agendamentos
    ORDER BY data ASC
  `;

  db.query(sql, (err, resultados) => {
    if (err) {
      console.error('Erro ao listar agendamentos:', err);
      return res.status(500).json({ erro: 'Erro ao listar agendamentos' });
    }

    // Adaptar ao formato esperado pelo FullCalendar
    const eventos = resultados.map(item => ({
      id: item.id,
      title: `${item.tipo_terapia} - ${item.nome}`,
      start: item.data
    }));

    res.json(eventos);
  });
};
