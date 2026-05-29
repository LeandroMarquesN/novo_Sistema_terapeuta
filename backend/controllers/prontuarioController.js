/**
 * MedLM - Controller de Prontuários (Corrigido)
 */
const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
// CORREÇÃO: Importamos o serviço corretamente
const notificationService = require('../services/notificationService');

// 1. SALVAR PRONTUÁRIO
exports.salvarProntuario = async (req, res) => {
  const { pacienteId, agendamentoId, codigoCid, relatoClinico } = req.body;
  const usuarioId = req.usuario?.id;
  const clinicaId = req.usuario?.clinica_id;

  if (!pacienteId || !relatoClinico) {
    return res.status(400).json({ erro: "Dados obrigatórios ausentes." });
  }

  try {
    const sql = `
      INSERT INTO prontuarios
      (clinica_id, paciente_id, usuario_id, agendamento_id, texto_evolucao, diagnostico_cid, status_prontuario, data_atendimento)
      VALUES (?, ?, ?, ?, ?, ?, 'finalizado', NOW())
    `;

    const [result] = await db.query(sql, [
      clinicaId,
      pacienteId,
      usuarioId,
      agendamentoId || null,
      relatoClinico,
      codigoCid || null
    ]);

    if (agendamentoId) {
      await db.query('UPDATE agendamentos SET status_agendamento = "finalizado" WHERE id = ?', [agendamentoId]);
    }

    res.status(201).json({ success: true, prontuarioId: result.insertId });
  } catch (error) {
    console.error("ERRO AO SALVAR PRONTUÁRIO:", error);
    res.status(500).json({ erro: "Erro crítico ao persistir prontuário." });
  }
};

// 2. LISTAR HISTÓRICO
exports.listarHistorico = async (req, res) => {
  const { pacienteId } = req.params;
  const clinicaId = req.usuario.clinica_id;
  try {
    const sql = `
      SELECT id, data_atendimento AS data_registro, texto_evolucao AS relato_clinico, diagnostico_cid AS codigo_cid
      FROM prontuarios
      WHERE paciente_id = ? AND clinica_id = ?
      ORDER BY data_atendimento DESC
    `;
    const [historico] = await db.query(sql, [pacienteId, clinicaId]);
    res.json(historico);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

// 3. OBTER DETALHE COMPLETO
exports.obterDetalheProntuario = async (req, res) => {
  const { id } = req.params;
  const clinicaId = req.usuario.clinica_id;

  try {
    const sql = `
      SELECT p.*, u.nome as nome_profissional, pac.nome as nome_paciente
      FROM prontuarios p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN pacientes pac ON p.paciente_id = pac.id
      WHERE p.id = ? AND p.clinica_id = ?
    `;
    const [rows] = await db.query(sql, [id, clinicaId]);

    if (!rows || rows.length === 0) return res.status(404).json({ msg: "Registro não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

// 4. ENVIO DE EMAIL (BLINDADO)
exports.enviarProntuarioEmail = async (req, res) => {
  const { prontuarioId } = req.body;
  const clinicaId = req.usuario.clinica_id;

  try {
    const [rows] = await db.query(`
          SELECT p.*, u.nome as nome_profissional, pac.nome as nome_paciente, pac.email as email_paciente
          FROM prontuarios p
          JOIN usuarios u ON p.usuario_id = u.id
          JOIN pacientes pac ON p.paciente_id = pac.id
          WHERE p.id = ? AND p.clinica_id = ?`, [prontuarioId, clinicaId]);

    if (rows.length === 0) return res.status(404).json({ erro: "Prontuário não encontrado." });

    const dados = rows[0];

    const dadosEnvio = {
      nome_paciente: dados.nome_paciente,
      email_paciente: dados.email_paciente,
      nome_profissional: dados.nome_profissional,
      data_atendimento: new Date(dados.data_atendimento).toLocaleDateString('pt-BR'),
      codigo_cid: dados.diagnostico_cid || 'N/A',
      texto_evolucao: dados.texto_evolucao,
      qr_code_url: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://medlm.com.br/validar/" + dados.id
    };

    // Agora sim, a variável notificationService existe e está pronta!
    await notificationService.sendProntuarioEmailNotification(dadosEnvio);

    res.json({ success: true, message: "Prontuário enviado com sucesso!" });

  } catch (error) {
    console.error("ERRO NO ENVIO:", error);
    res.status(500).json({ erro: "Falha ao enviar e-mail: " + error.message });
  }
};