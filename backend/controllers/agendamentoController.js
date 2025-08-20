// agendamentoController.js
console.log('--- agendamentoController.js carregado ---');

const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// Importa o serviço de notificações
const notificationService = require('../services/notificationService');

const uploadDir = path.join(__dirname, '..', 'uploads');

// Assegura que o diretório de uploads existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// --- Função para criar um novo agendamento ---
exports.criarAgendamento = async (req, res) => {
  console.log('Dados do formulário (req.body):', req.body);
  console.log('Anexos (req.files):', req.files);

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
    observacoes
  } = req.body;

  const patientPhoto = req.files['patient_photo'] ? req.files['patient_photo'][0] : null;
  const anexos = req.files['anexos'] || [];
  let fotoPerfilFilename = patientPhoto ? patientPhoto.filename : null;

  let condicoesString = '';
  if (req.body.condicoes) {
    try {
      const condicoesArray = JSON.parse(req.body.condicoes);
      if (Array.isArray(condicoesArray)) {
        condicoesString = condicoesArray.join(', ');
      }
    } catch (e) {
      console.error('Erro ao fazer parse das condições de saúde:', e);
      condicoesString = String(req.body.condicoes);
    }
  }

  if (!nome || !data_agendamento) {
    return res.status(400).json({ mensagem: 'Nome e data de agendamento são obrigatórios.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let paciente_id;

    // 1. Verifica se o paciente já existe
    const [pacientesExistentes] = await connection.query(
      'SELECT id FROM pacientes WHERE nome = ? AND data_nascimento = ?',
      [nome, data_nascimento]
    );

    if (pacientesExistentes.length > 0) {
      paciente_id = pacientesExistentes[0].id;
      console.log('Paciente existente encontrado, ID:', paciente_id);
    } else {
      // 2. Se não existir, cria um novo paciente
      const [novoPacienteResult] = await connection.query(
        `INSERT INTO pacientes (
          nome, email, telefone, data_nascimento, foto_perfil
        ) VALUES (?, ?, ?, ?, ?)`,
        [nome, email || null, telefone || null, data_nascimento || null, fotoPerfilFilename || null]
      );
      paciente_id = novoPacienteResult.insertId;
      console.log('Novo paciente criado, ID:', paciente_id);
    }

    // 3. Insere o agendamento
    const sqlAgendamento = `
      INSERT INTO agendamentos (
        paciente_id, nome, data_agendamento, tipo_terapia, observacoes,
        status_pagamento, peso, altura, data_nascimento, idade, tipo_sanguineo,
        motivo_consulta, origem_indicacao, condicoes, email, telefone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresAgendamento = [
      paciente_id, nome, data_agendamento, tipo_terapia, observacoes || null, 'pendente',
      peso || null, altura || null, data_nascimento || null, idade || null,
      tipo_sanguineo || null, motivo_consulta || null, origem_indicacao || null,
      condicoesString || null, email || null, telefone || null
    ];

    const [agendamentoResult] = await connection.query(sqlAgendamento, valoresAgendamento);
    const agendamentoId = agendamentoResult.insertId;
    console.log('Agendamento inserido, ID:', agendamentoId);

    // 4. Insere anexos
    if (anexos.length > 0) {
      for (const file of anexos) {
        await connection.query(
          `INSERT INTO anexos (
            agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes
          ) VALUES (?, ?, ?, ?, ?)`,
          [agendamentoId, file.originalname, file.filename, file.mimetype, file.size]
        );
      }
      console.log(`${anexos.length} anexos inseridos na tabela 'anexos'.`);
    }

    await connection.commit();
    res.status(201).json({ mensagem: 'Agendamento, paciente e anexos salvos com sucesso!' });

    // --- Envia notificações depois de salvar e responder ---
    if (email) {
      notificationService.sendEmailNotification({
        nome,
        email,
        tipo_terapia,
        data_agendamento,
        motivo_consulta
      });
    }

    if (telefone) {
      notificationService.sendWhatsAppNotification({
        nome,
        telefone,
        tipo_terapia,
        data_agendamento
      });
    }

  } catch (err) {
    await connection.rollback();
    console.error('Erro ao salvar agendamento no backend:', err);

    if (patientPhoto && fs.existsSync(patientPhoto.path)) {
      fs.unlinkSync(patientPhoto.path);
      console.log(`Arquivo da foto do paciente ${patientPhoto.filename} removido devido a erro.`);
    }

    res.status(500).json({ erro: 'Erro ao salvar agendamento', detalhes: err.message, sql: err.sql, sqlMessage: err.sqlMessage });
  } finally {
    connection.release();
  }
};

// --- listarAgendamentos (sem mudanças) ---
exports.listarAgendamentos = async (req, res) => {
  try {
    const sqlAgendamentos = `
      SELECT id, paciente_id, nome, data_agendamento, tipo_terapia, observacoes,
             status_pagamento, peso, altura, data_nascimento, idade, tipo_sanguineo,
             motivo_consulta, origem_indicacao, condicoes, email, telefone
      FROM agendamentos
      ORDER BY data_agendamento ASC
    `;

    const [agendamentos] = await db.query(sqlAgendamentos);

    const sqlAnexos = `
      SELECT agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes
      FROM anexos
    `;
    const [anexos] = await db.query(sqlAnexos);

    const agendamentosComAnexos = agendamentos.map(agendamento => {
      const anexosDoAgendamento = anexos.filter(anexo => anexo.agendamento_id === agendamento.id);
      const anexosUnicos = anexosDoAgendamento.filter((anexo, index, self) =>
        index === self.findIndex(t => t.nome_original === anexo.nome_original)
      );
      return { ...agendamento, anexos: anexosUnicos };
    });

    res.json(agendamentosComAnexos);
  } catch (err) {
    console.error('Erro ao listar agendamentos no backend:', err);
    res.status(500).json({ erro: 'Erro ao listar agendamentos', detalhes: err.message });
  }
};

// --- deletarAgendamento (sem mudanças) ---
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
