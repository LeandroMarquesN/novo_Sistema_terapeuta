// backend/controllers/agendamentoController.js

console.log('--- agendamentoController.js carregado ---');

const db = require('../config/db'); // Certifique-se de que este importa um pool de conexão ou conexão que suporta promessas (ex: mysql2/promise)

// --- Função para criar um novo agendamento ---
exports.criarAgendamento = async (req, res) => {
  // Desestrutura todos os campos recebidos do formulário HTML
  const {
    nome,
    data_nascimento,
    idade,
    peso,
    altura,
    tipo_sanguineo,
    tipo_terapia,
    data_agendamento,
    motivo_consulta,
    origem_indicacao,
    observacoes
  } = req.body;

  // Lida com o arquivo de anexo, se houver
  const anexo = req.file ? req.file.filename : null;

  let condicoesString = '';
  if (req.body.condicoes) {
    if (Array.isArray(req.body.condicoes)) {
      condicoesString = req.body.condicoes.join(', ');
    } else {
      condicoesString = String(req.body.condicoes);
    }
  }

  console.log('Dados recebidos no backend para criarAgendamento (req.body):', req.body);
  console.log('Condições (string final):', condicoesString);
  console.log('Anexo recebido (req.file):', req.file);

  try {
    let paciente_id;

    // 1. Tenta encontrar um paciente existente pelo nome e data de nascimento
    const [pacientesExistentes] = await db.query(
      'SELECT id FROM pacientes WHERE nome = ? AND data_nascimento = ?',
      [nome, data_nascimento]
    );

    if (pacientesExistentes.length > 0) {
      paciente_id = pacientesExistentes[0].id;
      console.log('Paciente existente encontrado, ID:', paciente_id);
    } else {
      // Inserção básica de paciente para agendamento
      const [novoPacienteResult] = await db.query(
        `INSERT INTO pacientes (nome, data_nascimento) VALUES (?, ?)`,
        [nome, data_nascimento]
      );
      paciente_id = novoPacienteResult.insertId;
      console.log('Novo paciente criado, ID:', paciente_id);
    }

    // 2. Insere os dados na tabela 'agendamentos'
    // REMOVIDA 'anotacoes' do INSERT statement e dos valores
    const sql = `
      INSERT INTO agendamentos (
        paciente_id,
        nome,
        data_agendamento,
        tipo_terapia,
        observacoes,
        status_pagamento,
        peso,
        altura,
        data_nascimento,
        idade,
        tipo_sanguineo,
        motivo_consulta,
        origem_indicacao,
        condicoes,
        anexo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valores = [
      paciente_id,
      nome,
      data_agendamento,
      tipo_terapia,
      observacoes || null,
      'pendente', // status_pagamento padrão
      peso || null,
      altura || null,
      data_nascimento || null,
      idade || null,
      tipo_sanguineo || null,
      motivo_consulta || null,
      origem_indicacao || null,
      condicoesString || null,
      anexo || null
    ];

    console.log('Valores a serem inseridos no agendamento (array final):', valores);
    console.log('Número de valores no array:', valores.length);

    await db.query(sql, valores);
    res.status(201).json({ mensagem: 'Agendamento e paciente salvos com sucesso!' });

  } catch (err) {
    console.error('Erro ao salvar agendamento no backend:', err);
    res.status(500).json({ erro: 'Erro ao salvar agendamento', detalhes: err.message, sql: err.sql, sqlMessage: err.sqlMessage });
  }
};

// --- Função para listar todos os agendamentos (ATUALIZADA para corresponder init.sql) ---
exports.listarAgendamentos = async (req, res) => {
  try {
    // Ajustado o SELECT para corresponder EXATAMENTE às colunas do seu init.sql
    const sql = `
      SELECT
        id,
        paciente_id,
        nome,
        data_agendamento,
        tipo_terapia,
        observacoes,
        status_pagamento,
        peso,
        altura,
        data_nascimento,
        idade,
        tipo_sanguineo,
        motivo_consulta,
        origem_indicacao,
        condicoes,
        anexo
      FROM agendamentos
      ORDER BY data_agendamento ASC
    `;

    const [resultados] = await db.query(sql);

    console.log('Resultados brutos da query listarAgendamentos:', resultados);

    const agendamentosFormatados = resultados.map(item => ({
      id: item.id,
      paciente_id: item.paciente_id,
      nome: item.nome,
      data_agendamento: item.data_agendamento,
      tipo_terapia: item.tipo_terapia,
      observacoes: item.observacoes,
      status_pagamento: item.status_pagamento,
      peso: item.peso,
      altura: item.altura,
      data_nascimento: item.data_nascimento,
      idade: item.idade,
      tipo_sanguineo: item.tipo_sanguineo,
      motivo_consulta: item.motivo_consulta,
      origem_indicacao: item.origem_indicacao,
      condicoes: item.condicoes,
      anexo: item.anexo
      // REMOVIDA 'anotacoes' do objeto retornado
    }));

    console.log('Dados formatados para o frontend:', agendamentosFormatados);

    res.json(agendamentosFormatados);
  } catch (err) {
    console.error('Erro ao listar agendamentos no backend:', err);
    res.status(500).json({ erro: 'Erro ao listar agendamentos', detalhes: err.message });
  }
};

// --- REMOVIDA A FUNÇÃO atualizarAgendamento, pois 'anotacoes' não existe na tabela 'agendamentos' ---
// Para ter funcionalidades de edição, você precisaria de uma tabela ou coluna para isso.