console.log('--- agendamentoController.js carregado ---');

const db = require('../config/db');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');

// --- Função para criar um novo agendamento ---
exports.criarAgendamento = async (req, res) => {
  const {
    nome,
    email,
    telefone,
    data_nascimento,
    idade,
    peso,
    altura,
    tipo_sanguineo,
    tipo_terapia,
    data_agendamento,
    motivo_consulta,
    origem_indicacao,
    observacoes,
    patient_photo // Campo da foto em Base64
  } = req.body;

  let fotoPerfilFilename = null;
  // Verifica se a foto em Base64 é uma string não vazia
  if (typeof patient_photo === 'string' && patient_photo.length > 0) {
    try {
      const base64Data = patient_photo.replace(/^data:image\/jpeg;base64,/, "");
      fotoPerfilFilename = `paciente_${Date.now()}_perfil.jpeg`;
      const filePath = path.join(uploadDir, fotoPerfilFilename);
      fs.writeFileSync(filePath, base64Data, 'base64');
      console.log(`Foto de perfil do paciente salva em: ${filePath}`);
    } catch (err) {
      console.error('Erro ao salvar foto de perfil do paciente:', err);
      fotoPerfilFilename = null;
    }
  }

  let condicoesString = '';
  if (req.body.condicoes) {
    if (Array.isArray(req.body.condicoes)) {
      condicoesString = req.body.condicoes.join(', ');
    } else {
      condicoesString = String(req.body.condicoes);
    }
  }

  console.log('Dados recebidos no backend para criarAgendamento (req.body):', req.body);
  console.log('Anexos recebidos (req.files):', req.files);
  console.log('Nome do arquivo da foto de perfil:', fotoPerfilFilename);

  try {
    // Lógica de transação REMOVIDA para evitar o TypeError.

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
      // 2. Se o paciente não existir, cria um novo
      // Nota: A query foi corrigida para corresponder aos valores enviados
      const [novoPacienteResult] = await db.query(
        `INSERT INTO pacientes (
          nome,
          email,
          telefone,
          data_nascimento,
          foto_perfil
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          nome,
          email || null,
          telefone || null,
          data_nascimento || null,
          fotoPerfilFilename || null
        ]
      );
      paciente_id = novoPacienteResult.insertId;
      console.log('Novo paciente criado, ID:', paciente_id);
    }

    // 3. Insere os dados na tabela 'agendamentos'
    const sqlAgendamento = `
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
        email,
        telefone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresAgendamento = [
      paciente_id,
      nome,
      data_agendamento,
      tipo_terapia,
      observacoes || null,
      'pendente',
      peso || null,
      altura || null,
      data_nascimento || null,
      idade || null,
      tipo_sanguineo || null,
      motivo_consulta || null,
      origem_indicacao || null,
      condicoesString || null,
      email || null,
      telefone || null
    ];

    const [agendamentoResult] = await db.query(sqlAgendamento, valoresAgendamento);
    const agendamentoId = agendamentoResult.insertId;
    console.log('Agendamento inserido, ID:', agendamentoId);

    // 4. Insere cada anexo na tabela 'anexos'
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.query(
          `INSERT INTO anexos (
            agendamento_id,
            nome_original,
            caminho_servidor,
            mime_type,
            tamanho_bytes
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            agendamentoId,
            file.originalname,
            file.filename,
            file.mimetype,
            file.size
          ]
        );
      }
      console.log(`${req.files.length} anexos inseridos na tabela 'anexos'.`);
    }

    // Chamada db.commit() REMOVIDA
    res.status(201).json({ mensagem: 'Agendamento, paciente e anexos salvos com sucesso!' });

  } catch (err) {
    // Chamada db.rollback() REMOVIDA
    console.error('Erro ao salvar agendamento no backend:', err);
    res.status(500).json({ erro: 'Erro ao salvar agendamento', detalhes: err.message, sql: err.sql, sqlMessage: err.sqlMessage });
  }
};

// --- Função para listar todos os agendamentos ---
exports.listarAgendamentos = async (req, res) => {
  try {
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
        email,
        telefone
      FROM agendamentos
      ORDER BY data_agendamento ASC
    `;

    const [resultados] = await db.query(sql);
    console.log('Resultados brutos da query listarAgendamentos:', resultados);

    res.json(resultados);
  } catch (err) {
    console.error('Erro ao listar agendamentos no backend:', err);
    res.status(500).json({ erro: 'Erro ao listar agendamentos', detalhes: err.message });
  }
};

// --- Função para deletar um agendamento ---
exports.deletarAgendamento = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM agendamentos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Agendamento não encontrado.' });
    }

    res.status(200).json({ mensagem: 'Agendamento excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar agendamento:', err);
    res.status(500).json({ erro: 'Erro ao deletar agendamento', detalhes: err.message });
  }
};