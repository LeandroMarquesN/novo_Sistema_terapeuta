// agendamentoController.js
console.log('--- agendamentoController.js carregado ---');

const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const notificationService = require('../services/notificationService');

const uploadDir = path.join(__dirname, '..', 'uploads');

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

    const valoresAgendamentoFinal = [
      paciente_id, nome, data_agendamento, tipo_terapia, observacoes || null,
      'pendente', peso || null, altura || null, data_nascimento || null, idade || null, tipo_sanguineo || null,
      motivo_consulta || null, origem_indicacao || null, condicoesString || null, email || null, telefone || null
    ];

    const [agendamentoResult] = await connection.query(sqlAgendamento, valoresAgendamentoFinal);
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

// --- Função para listar todos os agendamentos ---
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

// --- Função para deletar um agendamento com notificação ---
exports.deletarAgendamento = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    // 1. Busca os dados do agendamento a ser deletado para notificação
    const [agendamentoParaDeletar] = await connection.query(
      'SELECT nome, email, data_agendamento FROM agendamentos WHERE id = ?',
      [id]
    );

    if (agendamentoParaDeletar.length === 0) {
      await connection.rollback();
      return res.status(404).json({ mensagem: 'Agendamento não encontrado.' });
    }

    // 2. Deleta o agendamento
    const [result] = await connection.query('DELETE FROM agendamentos WHERE id = ?', [id]);

    await connection.commit();
    res.status(200).json({ mensagem: 'Agendamento excluído com sucesso.' });

    // 3. Envia a notificação após o commit
    const { nome, email, data_agendamento } = agendamentoParaDeletar[0];
    if (email) {
      notificationService.sendCancellationEmail({
        nome,
        email,
        data_agendamento
      });
    }

  } catch (err) {
    await connection.rollback();
    console.error('Erro ao deletar agendamento:', err);
    res.status(500).json({ erro: 'Erro ao deletar agendamento', detalhes: err.message });
  } finally {
    connection.release();
  }
};

// ==================================================================================================
// FUNÇÃO ORIGINAL (agora com um novo nome, se necessário)
// Esta função lida com a atualização completa, incluindo uploads de arquivos.
// ==================================================================================================
exports.atualizarAgendamentoCompleto = async (req, res) => {
  const agendamentoId = req.params.id;
  console.log(`Atualizando agendamento completo com ID: ${agendamentoId}`);

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

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Atualizar o registro do agendamento
    const sqlUpdate = `
      UPDATE agendamentos SET
        nome = ?, email = ?, telefone = ?, data_nascimento = ?, idade = ?,
        peso = ?, altura = ?, tipo_sanguineo = ?, tipo_terapia = ?,
        data_agendamento = ?, motivo_consulta = ?, origem_indicacao = ?,
        observacoes = ?, condicoes = ?
      WHERE id = ?
    `;

    const valoresUpdate = [
      nome, email || null, telefone || null, data_nascimento || null, idade || null,
      peso || null, altura || null, tipo_sanguineo || null, tipo_terapia || null,
      data_agendamento, motivo_consulta || null, origem_indicacao || null,
      observacoes || null, condicoesString || null, agendamentoId
    ];

    const [updateResult] = await connection.query(sqlUpdate, valoresUpdate);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ mensagem: 'Agendamento não encontrado para ser atualizado.' });
    }

    // 2. Atualiza a foto de perfil do paciente (se uma nova for enviada)
    if (fotoPerfilFilename) {
      // Primeiro, encontre o ID do paciente associado ao agendamento
      const [agendamento] = await connection.query('SELECT paciente_id FROM agendamentos WHERE id = ?', [agendamentoId]);
      if (agendamento.length > 0) {
        const pacienteId = agendamento[0].paciente_id;
        // Agora, atualize o campo foto_perfil do paciente
        await connection.query('UPDATE pacientes SET foto_perfil = ? WHERE id = ?', [fotoPerfilFilename, pacienteId]);
      }
    }

    // 3. Gerencia anexos existentes e novos
    if (anexos.length > 0) {
      // Insere os novos anexos
      for (const file of anexos) {
        await connection.query(
          `INSERT INTO anexos (
                    agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes
                ) VALUES (?, ?, ?, ?, ?)`,
          [agendamentoId, file.originalname, file.filename, file.mimetype, file.size]
        );
      }
    }

    await connection.commit();
    res.status(200).json({ mensagem: 'Agendamento atualizado com sucesso!' });

    // --- Envia notificações de atualização ---
    if (email) {
      notificationService.sendEmailNotification({
        nome,
        email,
        tipo_terapia,
        data_agendamento,
        motivo_consulta
      }, true);
    }

    if (telefone) {
      notificationService.sendWhatsAppNotification({
        nome,
        telefone,
        tipo_terapia,
        data_agendamento
      }, true);
    }

  } catch (err) {
    await connection.rollback();
    console.error('Erro ao atualizar agendamento:', err);
    // Limpa os arquivos enviados em caso de erro
    if (patientPhoto && fs.existsSync(patientPhoto.path)) {
      fs.unlinkSync(patientPhoto.path);
    }
    anexos.forEach(anexo => {
      if (fs.existsSync(anexo.path)) {
        fs.unlinkSync(anexo.path);
      }
    });

    res.status(500).json({ erro: 'Erro ao atualizar agendamento', detalhes: err.message, sql: err.sql, sqlMessage: err.sqlMessage });
  } finally {
    connection.release();
  }
};

// ==================================================================================================
// FUNÇÃO EXCLUSIVA PARA REAGENDAMENTO (SOMENTE DATA)
// Esta função lida apenas com a atualização da data e hora.
// ==================================================================================================
exports.reagendarAgendamento = async (req, res) => {
  const agendamentoId = req.params.id;
  const { data_agendamento } = req.body;

  if (!data_agendamento) {
    return res.status(400).json({ mensagem: 'Nova data de agendamento é obrigatória.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Busca os dados do agendamento para a notificação ANTES de atualizar
    const [agendamento] = await connection.query(
      'SELECT nome, email, tipo_terapia, data_agendamento FROM agendamentos WHERE id = ?',
      [agendamentoId]
    );

    if (agendamento.length === 0) {
      await connection.rollback();
      return res.status(404).json({ mensagem: 'Agendamento não encontrado para ser reagendado.' });
    }

    const { nome, email, tipo_terapia } = agendamento[0];
    const dataAnterior = agendamento[0].data_agendamento;

    // 2. Atualiza a data do agendamento
    const [updateResult] = await connection.query(
      `UPDATE agendamentos SET data_agendamento = ? WHERE id = ?`,
      [data_agendamento, agendamentoId]
    );

    await connection.commit();
    res.status(200).json({ mensagem: 'Agendamento reagendado com sucesso!' });

    // 3. Envia a notificação após o commit e a resposta
    if (email) {
      // Reutiliza o mesmo serviço de notificação, passando a data anterior e a nova
      notificationService.sendReschedulingEmail({
        nome,
        email,
        tipo_terapia,
        data_agendamento, // Nova data
        dataAnterior // Data anterior
      });
    }

  } catch (err) {
    await connection.rollback();
    console.error('Erro ao reagendar agendamento (somente data):', err);
    res.status(500).json({ erro: 'Erro ao reagendar agendamento', detalhes: err.message });
  } finally {
    connection.release();
  }
};