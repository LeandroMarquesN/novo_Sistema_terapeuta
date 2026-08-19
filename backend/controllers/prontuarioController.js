/**
 * MedLM - Controller de Prontuários
 * Conformidade jurídica: autoria vinculada à sessão, imutabilidade pós-finalização,
 * assinatura por confirmação de senha e trilha de auditoria.
 */
const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');

// 1. SALVAR PRONTUÁRIO (assinatura eletrônica por senha)
exports.salvarProntuario = async (req, res) => {
  const { pacienteId, agendamentoId, codigoCid, relatoClinico, senhaAssinatura } = req.body;
  const usuarioId = req.usuario?.id;
  const clinicaId = req.usuario?.clinica_id;

  if (!pacienteId || !relatoClinico) {
    return res.status(400).json({ erro: "Dados obrigatórios ausentes." });
  }

  if (!senhaAssinatura) {
    return res.status(400).json({ erro: "Senha de assinatura é obrigatória para finalizar o prontuário." });
  }

  try {
    // 🔏 Confirmação de identidade no momento da assinatura
    const [userRows] = await db.query('SELECT senha FROM usuarios WHERE id = ?', [usuarioId]);
    if (!userRows.length) {
      return res.status(401).json({ erro: "Usuário não encontrado." });
    }

    // ⚠️ TODO SEGURANÇA: authController.js atualmente compara senha em texto puro
    // (usuarios.senha não está hasheada). Esta comparação segue o mesmo padrão por
    // consistência, mas o ideal é migrar para bcrypt o quanto antes:
    //   const senhaValida = bcrypt.compareSync(senhaAssinatura, userRows[0].senha);
    const senhaValida = senhaAssinatura === userRows[0].senha;
    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha incorreta. Assinatura não confirmada." });
    }

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

    // Registro de auditoria da assinatura confirmada por senha
    await auditService.registrarLog(usuarioId, result.insertId, 'ASSINOU_COM_SENHA');

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

// 3. OBTER DETALHE COMPLETO (com CRM/UF do profissional via JOIN)
exports.obterDetalheProntuario = async (req, res) => {
  const { id } = req.params;
  const clinicaId = req.usuario.clinica_id;

  try {
    const sql = `
      SELECT p.*,
             u.nome as nome_profissional,
             u.crm as crm_profissional,
             u.uf_crm as uf_crm_profissional,
             pac.nome as nome_paciente
      FROM prontuarios p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN pacientes pac ON p.paciente_id = pac.id
      WHERE p.id = ? AND p.clinica_id = ?
    `;
    const [rows] = await db.query(sql, [id, clinicaId]);

    if (!rows || rows.length === 0) return res.status(404).json({ msg: "Registro não encontrado." });

    // --- REGISTRO DE AUDITORIA ---
    await auditService.registrarLog(req.usuario.id, id, 'VISUALIZOU');

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

// 4. ATUALIZAR PRONTUÁRIO — trava jurídica de imutabilidade
exports.atualizarProntuario = async (req, res) => {
  const { id } = req.params;
  const { codigoCid, relatoClinico } = req.body;
  const clinicaId = req.usuario?.clinica_id;
  const usuarioId = req.usuario?.id; // autoria sempre da sessão, nunca do body

  if (!relatoClinico) {
    return res.status(400).json({ erro: "Dados obrigatórios ausentes." });
  }

  try {
    // Confere existência + status ANTES de qualquer escrita
    const [rows] = await db.query(
      'SELECT status_prontuario FROM prontuarios WHERE id = ? AND clinica_id = ?',
      [id, clinicaId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ erro: "Registro não encontrado." });
    }

    if (rows[0].status_prontuario === 'finalizado') {
      return res.status(403).json({
        erro: "Este prontuário já foi finalizado e está travado para edição.",
        codigo: "PRONTUARIO_TRAVADO"
      });
    }

    await db.query(
      'UPDATE prontuarios SET texto_evolucao = ?, diagnostico_cid = ? WHERE id = ? AND clinica_id = ?',
      [relatoClinico, codigoCid || null, id, clinicaId]
    );

    await auditService.registrarLog(usuarioId, id, 'EDITOU');

    res.json({ success: true, message: "Prontuário atualizado com sucesso." });
  } catch (error) {
    console.error("ERRO AO ATUALIZAR PRONTUÁRIO:", error);
    res.status(500).json({ erro: "Erro crítico ao atualizar prontuário." });
  }
};

// 5. ENVIO DE EMAIL (com token)
exports.enviarProntuarioEmail = async (req, res) => {
  const { prontuarioId } = req.body;
  const clinicaId = req.usuario.clinica_id;

  try {
    const [rows] = await db.query(`
      SELECT 
        p.*, 
        u.nome as nome_profissional, 
        pac.nome as nome_paciente, 
        pac.email as email_paciente,
        pac.token_acesso
      FROM prontuarios p
      JOIN usuarios u ON p.usuario_id = u.id
      JOIN pacientes pac ON p.paciente_id = pac.id
      WHERE p.id = ? AND p.clinica_id = ?
    `, [prontuarioId, clinicaId]);

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Prontuário não encontrado." });
    }

    const dados = rows[0];

    // Auditoria
    await auditService.registrarLog(req.usuario.id, prontuarioId, 'ENVIOU_EMAIL');

    const dadosEnvio = {
      nome_paciente: dados.nome_paciente,
      email_paciente: dados.email_paciente,
      nome_profissional: dados.nome_profissional,
      data_atendimento: new Date(dados.data_atendimento).toLocaleDateString('pt-BR'),
      codigo_cid: dados.diagnostico_cid ? dados.diagnostico_cid : 'Não informado!',
      texto_evolucao: dados.texto_evolucao,
      qr_code_url: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://medlm.com.br/validar/" + dados.id,
      token_acesso: dados.token_acesso
    };

    await notificationService.sendProntuarioEmailNotification(dadosEnvio);

    res.json({ success: true, message: "Prontuário enviado com sucesso!" });

  } catch (error) {
    console.error("ERRO NO ENVIO:", error);
    res.status(500).json({ erro: "Falha ao enviar e-mail: " + error.message });
  }
};

// 6. LISTAR LOGS DE AUDITORIA
exports.listarLogs = async (req, res) => {
  const { prontuarioId } = req.params;
  try {
    const [logs] = await db.query(
      `SELECT 
         l.id,
         l.usuario_id,
         l.prontuario_id,
         l.acao,
         l.data_acesso,
         u.nome AS usuario_nome,
         COALESCE(l.crm, u.crm) AS usuario_crm,
         COALESCE(l.uf_crm, u.uf_crm) AS usuario_uf_crm
       FROM logs_auditoria l
       JOIN usuarios u ON l.usuario_id = u.id
       WHERE l.prontuario_id = ?
       ORDER BY l.data_acesso DESC`,
      [prontuarioId]
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};