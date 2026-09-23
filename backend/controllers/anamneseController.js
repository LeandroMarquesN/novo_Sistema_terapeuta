// controllers/anamneseController.js
const db = require('../config/db'); // ajuste o path se o projeto usar outro módulo de conexão

/**
 * Lista modelos ativos (sistema + da clínica)
 * GET /api/anamnese/modelos
 */
exports.listarModelos = async (req, res) => {
  try {
    const clinicaId = req.usuario?.clinica_id;
    if (!clinicaId) {
      return res.status(401).json({ erro: 'Clínica não identificada no token.' });
    }

    const [modelos] = await db.execute(
      `SELECT id, profissao, nome, descricao, icone, ordem
       FROM modelos_anamnese
       WHERE ativo = 1 AND (clinica_id IS NULL OR clinica_id = ?)
       ORDER BY ordem ASC, nome ASC`,
      [clinicaId]
    );

    res.json({ modelos });
  } catch (err) {
    console.error('[anamnese] listarModelos:', err);
    res.status(500).json({ erro: 'Falha ao listar modelos de anamnese.' });
  }
};

/**
 * Detalhe do modelo + campos
 * GET /api/anamnese/modelos/:id
 */
exports.obterModelo = async (req, res) => {
  try {
    const clinicaId = req.usuario?.clinica_id;
    const modeloId = parseInt(req.params.id, 10);
    if (!clinicaId || !modeloId) {
      return res.status(400).json({ erro: 'Parâmetros inválidos.' });
    }

    const [modelos] = await db.execute(
      `SELECT id, profissao, nome, descricao, icone
       FROM modelos_anamnese
       WHERE id = ? AND ativo = 1 AND (clinica_id IS NULL OR clinica_id = ?)
       LIMIT 1`,
      [modeloId, clinicaId]
    );

    if (!modelos.length) {
      return res.status(404).json({ erro: 'Modelo não encontrado.' });
    }

    const [campos] = await db.execute(
      `SELECT id, secao, tipo, rotulo, placeholder, opcoes, obrigatorio, ordem
       FROM modelos_anamnese_campos
       WHERE modelo_id = ?
       ORDER BY ordem ASC, id ASC`,
      [modeloId]
    );

    // Normaliza opcoes JSON
    const camposNorm = campos.map((c) => {
      let opcoes = c.opcoes;
      if (typeof opcoes === 'string') {
        try { opcoes = JSON.parse(opcoes); } catch (_) { opcoes = null; }
      }
      return { ...c, opcoes };
    });

    res.json({ modelo: modelos[0], campos: camposNorm });
  } catch (err) {
    console.error('[anamnese] obterModelo:', err);
    res.status(500).json({ erro: 'Falha ao carregar modelo.' });
  }
};

/**
 * Salvar anamnese preenchida
 * POST /api/anamnese/salvar
 * body: { paciente_id, agendamento_id?, modelo_id, respostas, status_anamnese? }
 */
exports.salvarAnamnese = async (req, res) => {
  try {
    const clinicaId = req.usuario?.clinica_id;
    const usuarioId = req.usuario?.id;
    if (!clinicaId || !usuarioId) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    const {
      paciente_id,
      agendamento_id = null,
      prontuario_id = null,
      modelo_id,
      respostas,
      status_anamnese = 'rascunho',
      id = null
    } = req.body || {};

    if (!paciente_id || !modelo_id || !respostas) {
      return res.status(400).json({ erro: 'paciente_id, modelo_id e respostas são obrigatórios.' });
    }

    // Resolve prontuário vinculado
    let prontuarioIdValido = null;

    if (prontuario_id) {
      const [pr] = await db.execute(
        `SELECT id FROM prontuarios
         WHERE id = ? AND clinica_id = ? AND paciente_id = ?
         LIMIT 1`,
        [prontuario_id, clinicaId, paciente_id]
      );
      if (!pr.length) {
        return res.status(400).json({ erro: 'Prontuário inválido para este paciente.' });
      }
      prontuarioIdValido = pr[0].id;
    }

    // Auto-vínculo: mesmo agendamento
    if (!prontuarioIdValido && agendamento_id) {
      const [pr] = await db.execute(
        `SELECT id FROM prontuarios
         WHERE clinica_id = ? AND paciente_id = ? AND agendamento_id = ?
         ORDER BY id DESC LIMIT 1`,
        [clinicaId, paciente_id, agendamento_id]
      );
      if (pr.length) prontuarioIdValido = pr[0].id;
    }

    // Auto-vínculo: prontuário mais recente do paciente (últimas 24h)
    if (!prontuarioIdValido) {
      const [pr] = await db.execute(
        `SELECT id FROM prontuarios
         WHERE clinica_id = ? AND paciente_id = ?
           AND data_atendimento >= (NOW() - INTERVAL 1 DAY)
         ORDER BY data_atendimento DESC, id DESC
         LIMIT 1`,
        [clinicaId, paciente_id]
      );
      if (pr.length) prontuarioIdValido = pr[0].id;
    }

    const status = status_anamnese === 'finalizado' ? 'finalizado' : 'rascunho';
    const respostasJson = typeof respostas === 'string' ? respostas : JSON.stringify(respostas);

    if (id) {
      const [result] = await db.execute(
        `UPDATE anamneses_preenchidas
         SET respostas = ?, status_anamnese = ?,
             prontuario_id = COALESCE(?, prontuario_id),
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ? AND clinica_id = ? AND status_anamnese = 'rascunho'`,
        [respostasJson, status, prontuarioIdValido, id, clinicaId]
      );
      if (result.affectedRows === 0) {
        return res.status(403).json({ erro: 'Anamnese não encontrada ou já finalizada.' });
      }
      return res.json({ ok: true, id, status_anamnese: status, prontuario_id: prontuarioIdValido });
    }

    const [ins] = await db.execute(
      `INSERT INTO anamneses_preenchidas
        (clinica_id, paciente_id, usuario_id, agendamento_id, prontuario_id, modelo_id, respostas, status_anamnese)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clinicaId,
        paciente_id,
        usuarioId,
        agendamento_id,
        prontuarioIdValido,
        modelo_id,
        respostasJson,
        status
      ]
    );

    res.status(201).json({
      ok: true,
      id: ins.insertId,
      status_anamnese: status,
      prontuario_id: prontuarioIdValido
    });
  } catch (err) {
    console.error('[anamnese] salvarAnamnese:', err);
    res.status(500).json({ erro: 'Falha ao salvar anamnese.' });
  }
};



/**
 * Listar anamneses de um paciente
 * GET /api/anamnese/paciente/:pacienteId
 */
exports.listarPorPaciente = async (req, res) => {
  try {
    const clinicaId = req.usuario?.clinica_id;
    const pacienteId = parseInt(req.params.pacienteId, 10);
    if (!clinicaId || !pacienteId) {
      return res.status(400).json({ erro: 'Parâmetros inválidos.' });
    }

    const [rows] = await db.execute(
      `SELECT a.id, a.modelo_id, a.status_anamnese, a.data_preenchimento, a.criado_em,
              m.nome AS modelo_nome, m.profissao, m.icone,
              u.nome AS profissional_nome
       FROM anamneses_preenchidas a
       JOIN modelos_anamnese m ON m.id = a.modelo_id
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.clinica_id = ? AND a.paciente_id = ?
       ORDER BY a.data_preenchimento DESC`,
      [clinicaId, pacienteId]
    );

    res.json({ anamneses: rows });
  } catch (err) {
    console.error('[anamnese] listarPorPaciente:', err);
    res.status(500).json({ erro: 'Falha ao listar anamneses.' });
  }
};

/**
 * Detalhe de anamnese preenchida
 * GET /api/anamnese/detalhe/:id
 */
exports.obterDetalhe = async (req, res) => {
  try {
    const clinicaId = req.usuario?.clinica_id;
    const id = parseInt(req.params.id, 10);
    if (!clinicaId || !id) {
      return res.status(400).json({ erro: 'Parâmetros inválidos.' });
    }

    const [rows] = await db.execute(
      `SELECT a.*, m.nome AS modelo_nome, m.profissao, m.icone
       FROM anamneses_preenchidas a
       JOIN modelos_anamnese m ON m.id = a.modelo_id
       WHERE a.id = ? AND a.clinica_id = ?
       LIMIT 1`,
      [id, clinicaId]
    );

    if (!rows.length) {
      return res.status(404).json({ erro: 'Anamnese não encontrada.' });
    }

    const row = rows[0];
    if (typeof row.respostas === 'string') {
      try { row.respostas = JSON.parse(row.respostas); } catch (_) {}
    }

    res.json({ anamnese: row });
  } catch (err) {
    console.error('[anamnese] obterDetalhe:', err);
    res.status(500).json({ erro: 'Falha ao obter anamnese.' });
  }
};
