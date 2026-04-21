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

exports.criarAgendamento = async (req, res) => {
  // --- TRAVA DE SEGURANÇA ---
  if (!req.usuario) {
    return res.status(401).json({ error: "Sessão inválida. Por favor, faça login novamente." });
  }

  // 1. Mude de const para let para podermos alterar o valor
  let {
    nome, cpf, email, telefone, data_nascimento, idade,
    peso, altura, tipo_sanguineo, tipo_terapia,
    data_agendamento, motivo_consulta, origem_indicacao, observacoes
  } = req.body;

  // 2. A "blindagem" contra o fuso horário (UTC)
  if (data_agendamento) {
    // Se vier 2026-04-20T17:01, vira 2026-04-20 17:01:00
    // O .split('.')[0] remove milissegundos se existirem
    data_agendamento = data_agendamento.replace('T', ' ').replace('Z', '').split('.')[0];
  }
  // ----------------------------------------------------

  const clinicaId = req.usuario.clinica_id;
  const usuarioId = req.usuario.id;
  // --------------------------

  const patientPhoto = req.files['patient_photo'] ? req.files['patient_photo'][0] : null;
  const anexos = req.files['anexos'] || [];
  let fotoPerfilFilename = patientPhoto ? patientPhoto.filename : null;

  let condicoesString = '';
  if (req.body.condicoes) {
    try {
      const condicoesArray = typeof req.body.condicoes === 'string' ? JSON.parse(req.body.condicoes) : req.body.condicoes;
      condicoesString = Array.isArray(condicoesArray) ? condicoesArray.join(', ') : String(req.body.condicoes);
    } catch (e) { condicoesString = String(req.body.condicoes); }
  }

  if (!nome || !cpf || !data_agendamento) {
    return res.status(400).json({ mensagem: 'Nome, CPF e data são obrigatórios.' });
  }

  const connection = await db.getConnection();
  try {
    // FORÇA A SESSÃO DO BANCO A USAR O HORÁRIO DE BRASÍLIA
    await connection.query("SET time_zone = '-03:00'");
    await connection.beginTransaction();
    let paciente_id;
    const [pacientesExistentes] = await connection.query(
      'SELECT id FROM pacientes WHERE cpf = ? AND clinica_id = ?',
      [cpf, clinicaId]
    );

    if (pacientesExistentes.length > 0) {
      paciente_id = pacientesExistentes[0].id;
      await connection.query(
        `UPDATE pacientes SET
          telefone = ?, email = ?, peso = ?, altura = ?,
          idade = ?, tipo_sanguineo = ?, condicoes_preexistentes = ?
         WHERE id = ?`,
        [telefone, email, peso, altura, idade, tipo_sanguineo, condicoesString, paciente_id]
      );
    } else {
      const [novoPacResult] = await connection.query(
        `INSERT INTO pacientes (
          clinica_id, nome, cpf, email, telefone, data_nascimento,
          idade, tipo_sanguineo, peso, altura, condicoes_preexistentes, foto_perfil
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clinicaId, nome, cpf, email, telefone, data_nascimento, idade, tipo_sanguineo, peso, altura, condicoesString, fotoPerfilFilename]
      );
      paciente_id = novoPacResult.insertId;
    }

    const sqlAgendamento = `
      INSERT INTO agendamentos (
        clinica_id, paciente_id, usuario_id, nome, data_agendamento,
        tipo_terapia, motivo_consulta, origem_indicacao, status_agendamento,
        peso, altura, data_nascimento, idade, tipo_sanguineo, email, telefone, cpf, condicoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresAgendamento = [
      clinicaId, paciente_id, usuarioId, nome, data_agendamento,
      tipo_terapia, motivo_consulta, origem_indicacao, 'aguardando_sinal',
      peso || null, altura || null, data_nascimento || null, idade || null,
      tipo_sanguineo || null, email || null, telefone || null, cpf, condicoesString
    ];

    const [agendamentoResult] = await connection.query(sqlAgendamento, valoresAgendamento);
    const agendamentoId = agendamentoResult.insertId;

    if (anexos.length > 0) {
      for (const file of anexos) {
        await connection.query(
          `INSERT INTO anexos (
            clinica_id, paciente_id, agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [clinicaId, paciente_id, agendamentoId, file.originalname, file.filename, file.mimetype, file.size]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ mensagem: 'Agendamento e Paciente processados com sucesso!', agendamentoId });

    // Notificações
    if (email) notificationService.sendEmailNotification({ nome, email, tipo_terapia, data_agendamento, motivo_consulta });
    if (telefone) notificationService.sendWhatsAppNotification({ nome, telefone, tipo_terapia, data_agendamento });

  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ erro: 'Erro ao criar agendamento', detalhes: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// =============================================================================
// 2. LISTAR AGENDAMENTOS
// =============================================================================
exports.listarAgendamentos = async (req, res) => {
  const clinicaId = req.usuario.clinica_id;

  console.log(`Buscando agendamentos para a clínica do usuário: ${clinicaId}`);
  try {
    const sqlAgendamentos = `
      SELECT id, paciente_id, nome, cpf, data_agendamento, tipo_terapia,
             motivo_consulta, origem_indicacao, status_agendamento,
             peso, altura, data_nascimento, idade, tipo_sanguineo, email, telefone, condicoes
      FROM agendamentos WHERE clinica_id = ? ORDER BY data_agendamento ASC
    `;
    const [agendamentos] = await db.query(sqlAgendamentos, [clinicaId]);

    if (agendamentos.length === 0) return res.json([]);

    const agendamentoIds = agendamentos.map(a => a.id);
    const [anexos] = await db.query(
      'SELECT agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes FROM anexos WHERE agendamento_id IN (?)',
      [agendamentoIds]
    );

    const agendamentosComAnexos = agendamentos.map(ag => {
      return { ...ag, anexos: anexos.filter(an => an.agendamento_id === ag.id) };
    });

    res.json(agendamentosComAnexos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar agendamentos', detalhes: err.message });
  }
};

// =============================================================================
// 3. DELETAR AGENDAMENTO
// =============================================================================
exports.deletarAgendamento = async (req, res) => {
  const connection = await db.getConnection();
  const clinicaId = req.usuario.clinica_id;
  try {
    const { id } = req.params;
    const [agendamento] = await connection.query(
      'SELECT nome, email, tipo_terapia, data_agendamento FROM agendamentos WHERE id = ? AND clinica_id = ?',
      [id, clinicaId]
    );

    if (agendamento.length === 0) return res.status(404).json({ mensagem: 'Não encontrado.' });

    const [result] = await connection.query('DELETE FROM agendamentos WHERE id = ? AND clinica_id = ?', [id, clinicaId]);

    res.status(200).json({ mensagem: 'Excluído com sucesso.' });

    if (agendamento[0].email) {
      notificationService.sendEmailNotification(agendamento[0], false, true);
    }
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar', detalhes: err.message });
  } finally {
    connection.release();
  }
};

// =============================================================================
// 4. ATUALIZAR COMPLETO
// =============================================================================
exports.atualizarAgendamentoCompleto = async (req, res) => {
  const agendamentoId = req.params.id;
  const clinicaId = req.usuario.clinica_id;
  const { nome, cpf, email, telefone, data_nascimento, idade, peso, altura, tipo_sanguineo, tipo_terapia, data_agendamento, motivo_consulta, origem_indicacao, observacoes } = req.body;
  const patientPhoto = req.files['patient_photo'] ? req.files['patient_photo'][0] : null;
  const anexos = req.files['anexos'] || [];

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [agendamentoAtual] = await connection.query('SELECT paciente_id FROM agendamentos WHERE id = ? AND clinica_id = ?', [agendamentoId, clinicaId]);
    if (agendamentoAtual.length === 0) throw new Error('Acesso negado');

    const pacienteId = agendamentoAtual[0].paciente_id;
    await connection.query(
      `UPDATE agendamentos SET nome=?, email=?, telefone=?, data_agendamento=?, cpf=? WHERE id=? AND clinica_id=?`,
      [nome, email, telefone, data_agendamento, cpf, agendamentoId, clinicaId]
    );

    if (anexos.length > 0) {
      for (const file of anexos) {
        await connection.query('INSERT INTO anexos (clinica_id, paciente_id, agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes) VALUES (?,?,?,?,?,?,?)', [clinicaId, pacienteId, agendamentoId, file.originalname, file.filename, file.mimetype, file.size]);
      }
    }

    await connection.commit();
    res.status(200).json({ mensagem: 'Atualizado com sucesso!' });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ erro: err.message });
  } finally {
    connection.release();
  }
};

// =============================================================================
// 5. REAGENDAR (SÓ DATA)
// =============================================================================
exports.reagendarAgendamento = async (req, res) => {
  const agendamentoId = req.params.id;
  const clinicaId = req.usuario.clinica_id;
  let { data_agendamento } = req.body;

  if (data_agendamento.includes('T')) {
    data_agendamento = data_agendamento.replace('T', ' ').substring(0, 19);
    if (data_agendamento.length === 16) data_agendamento += ':00';
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [updateResult] = await connection.query(
      'UPDATE agendamentos SET data_agendamento = ? WHERE id = ? AND clinica_id = ?',
      [data_agendamento, agendamentoId, clinicaId]
    );

    if (updateResult.affectedRows === 0) throw new Error('Agendamento não encontrado');

    const [dados] = await connection.query('SELECT nome, email, telefone, tipo_terapia FROM agendamentos WHERE id = ? AND clinica_id = ?', [agendamentoId, clinicaId]);
    await connection.commit();

    res.status(200).json({ mensagem: 'Reagendado com sucesso!' });
    if (dados.length > 0 && dados[0].email) {
      notificationService.sendEmailNotification({ ...dados[0], data_agendamento }, true);
    }
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ erro: err.message });
  } finally {
    connection.release();
  }
};