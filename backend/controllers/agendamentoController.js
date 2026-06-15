

const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Importa o serviço de notificações
const notificationService = require('../services/notificationService');

const uploadDir = path.join(__dirname, '..', 'uploads');

// Assegura que o diretório de uploads existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =============================================================================
// 1. CRIAR AGENDAMENTO
// =============================================================================
exports.criarAgendamento = async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: "Sessão inválida. Por favor, faça login novamente." });
  }

  let {
    nome, cpf, email, telefone, data_nascimento, idade,
    peso, genero, altura, tipo_sanguineo, tipo_terapia,
    data_agendamento, motivo_consulta, origem_indicacao, observacoes,
    valor_sinal
  } = req.body;

  if (data_agendamento) {
    data_agendamento = data_agendamento.replace('T', ' ').replace('Z', '').split('.')[0];
  }

  const clinicaId = req.usuario.clinica_id;
  const usuarioId = req.usuario.id;

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
    await connection.query("SET time_zone = '-03:00'");
    await connection.beginTransaction();

    // --- LÓGICA DE TOKEN DE ACESSO ---
    const novoToken = crypto.randomBytes(32).toString('hex');
    const dataExpiracao = new Date();
    dataExpiracao.setMonth(dataExpiracao.getMonth() + 3);
    dataExpiracao.setDate(dataExpiracao.getDate() + 10);

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
          idade = ?, tipo_sanguineo = ?, genero = ?,
          condicoes_preexistentes = ?, status_pagamento = 'pendente',
          token_acesso = ?, token_expiracao = ?
         WHERE id = ?`,
        [telefone, email, peso, altura, idade, tipo_sanguineo, genero, condicoesString, novoToken, dataExpiracao, paciente_id]
      );
    } else {
      const [novoPacResult] = await connection.query(
        `INSERT INTO pacientes (
          clinica_id, nome, cpf, email, telefone, data_nascimento,
          idade, tipo_sanguineo, peso, altura, genero,
          condicoes_preexistentes, foto_perfil, status_pagamento, token_acesso, token_expiracao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`,
        [clinicaId, nome, cpf, email, telefone, data_nascimento, idade, tipo_sanguineo, peso, altura, genero, condicoesString, fotoPerfilFilename, novoToken, dataExpiracao]
      );
      paciente_id = novoPacResult.insertId;
    }

    // --- LOGICA DE AGENDAMENTO ---
    const sqlAgendamento = `
      INSERT INTO agendamentos (
        clinica_id, paciente_id, usuario_id, nome, data_agendamento,
        tipo_terapia, motivo_consulta, origem_indicacao, status_agendamento,
        peso, genero, altura, data_nascimento, idade, tipo_sanguineo, email, telefone, cpf, condicoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresAgendamento = [
      clinicaId, paciente_id, usuarioId, nome, data_agendamento,
      tipo_terapia, motivo_consulta, origem_indicacao, 'aguardando_sinal',
      peso || null, genero || null, altura || null, data_nascimento || null, idade || null,
      tipo_sanguineo || null, email || null, telefone || null, cpf, condicoesString
    ];

    const [agendamentoResult] = await connection.query(sqlAgendamento, valoresAgendamento);
    const agendamentoId = agendamentoResult.insertId;

    // --- LOGICA FINANCEIRA ---
    let valorLimpo = 0.00;
    if (valor_sinal) {
      valorLimpo = parseFloat(valor_sinal.replace(/\./g, '').replace(',', '.'));
    }

    if (valorLimpo > 0) {
      await connection.query(
        `INSERT INTO financeiro (clinica_id, paciente_id, agendamento_id, tipo, descricao, valor, data_vencimento, status_pagamento) 
         VALUES (?, ?, ?, 'receita', ?, ?, CURDATE(), 'aberto')`,
        [clinicaId, paciente_id, agendamentoId, `Sinal de Consulta - ${nome}`, valorLimpo]
      );
    }

    // --- ANEXOS ---
    if (anexos.length > 0) {
      for (const file of anexos) {
        await connection.query(
          `INSERT INTO anexos (clinica_id, paciente_id, agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [clinicaId, paciente_id, agendamentoId, file.originalname, file.filename, file.mimetype, file.size]
        );
      }
    }

    await connection.commit();

    // --- NOTIFICAÇÕES ---
    const [clinicaResult] = await connection.query('SELECT nome_clinica, telefone_clinica FROM clinicas WHERE id = ?', [clinicaId]);
    const dadosDaClinica = clinicaResult[0];

    if (email && dadosDaClinica) {
      const dadosDoAgendamento = {
        nome: nome,
        email: email,
        telefone: telefone, // Adicionado aqui para o WhatsApp funcionar
        tipo_terapia: tipo_terapia,
        data_agendamento: data_agendamento,
        motivo_consulta: motivo_consulta,
        token_acesso: novoToken // Enviado para o service construir o link
      };

      notificationService.sendEmailNotification(dadosDaClinica, dadosDoAgendamento)
        .catch(err => console.error("[MED-LM] Erro no envio de e-mail:", err));
    }

    return res.status(201).json({
      mensagem: 'Processado com sucesso!',
      agendamentoId
    });

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

  try {
    // 1. Query turbinada com JOIN no Financeiro
    // Pegamos o status de pagamento e o valor diretamente da tabela financeira
    const sqlAgendamentos = `
      SELECT
        a.*,
        f.status_pagamento AS financeiro_status,
        f.valor AS valor_sinal,
        f.metodo_pagamento
      FROM agendamentos a
      LEFT JOIN financeiro f ON a.id = f.agendamento_id
      WHERE a.clinica_id = ?
      ORDER BY a.data_agendamento ASC
    `;

    const [agendamentos] = await db.query(sqlAgendamentos, [clinicaId]);

    if (agendamentos.length === 0) return res.json({ total: 0, dados: [] });

    // 2. Busca de Anexos (Mantendo sua lógica eficiente de IN)
    const agendamentoIds = agendamentos.map(a => a.id);
    const [anexos] = await db.query(
      'SELECT agendamento_id, nome_original, caminho_servidor, mime_type FROM anexos WHERE agendamento_id IN (?)',
      [agendamentoIds]
    );

    // 3. Processamento e "Inteligência" (BI simples)
    let totalMasculino = 0;
    let totalFeminino = 0;

    const dadosFormatados = agendamentos.map(ag => {
      // Contagem para o mini-dashboard
      if (ag.genero === 'Masculino') totalMasculino++;
      if (ag.genero === 'Feminino') totalFeminino++;

      return {
        ...ag,
        // Adicionamos uma "label" amigável para o frontend
        status_formatado: ag.status_agendamento.replace('_', ' ').toUpperCase(),
        data_ptbr: new Date(ag.data_agendamento).toLocaleString('pt-BR'),
        anexos: anexos.filter(an => an.agendamento_id === ag.id)
      };
    });

    // 4. Retorno Explicativo
    res.json({
      meta: {
        total_geral: agendamentos.length,
        distribuicao_genero: {
          masculino: totalMasculino,
          feminino: totalFeminino,
          outros: agendamentos.length - (totalMasculino + totalFeminino)
        }
      },
      dados: dadosFormatados
    });

  } catch (err) {
    console.error("Erro ao listar:", err);
    res.status(500).json({ erro: 'Erro ao listar agendamentos', detalhes: err.message });
  }
};
// ============================================================================
// 2.1 lista agendamento de hoje
// ============================================================================
exports.listarAgendamentosHoje = async (req, res) => {
  const clinicaId = req.usuario.clinica_id;
  // Pega a data de hoje no formato YYYY-MM-DD
  const hoje = new Date().toISOString().split('T')[0];

  try {
    const sqlAgendamentosHoje = `
      SELECT
        a.*,
        f.status_pagamento AS financeiro_status
      FROM agendamentos a
      LEFT JOIN financeiro f ON a.id = f.agendamento_id
      WHERE a.clinica_id = ? 
      AND DATE(a.data_agendamento) = ?
      ORDER BY a.data_agendamento ASC
    `;

    const [agendamentos] = await db.query(sqlAgendamentosHoje, [clinicaId, hoje]);

    // Retorna a lista simples para o seu botão de voz
    res.json(agendamentos);

  } catch (err) {
    console.error("Erro ao listar agenda de hoje:", err);
    res.status(500).json({ erro: 'Erro ao buscar agenda do dia' });
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
  const { nome, cpf, email, telefone, data_nascimento, idade, peso, genero, altura, tipo_sanguineo, tipo_terapia, data_agendamento, motivo_consulta, origem_indicacao, observacoes } = req.body;
  const patientPhoto = req.files['patient_photo'] ? req.files['patient_photo'][0] : null;
  const anexos = req.files['anexos'] || [];

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [agendamentoAtual] = await connection.query('SELECT paciente_id FROM agendamentos WHERE id = ? AND clinica_id = ?', [agendamentoId, clinicaId]);
    if (agendamentoAtual.length === 0) throw new Error('Acesso negado');

    const pacienteId = agendamentoAtual[0].paciente_id;
    await connection.query(
      `UPDATE agendamentos SET nome=?, email=?, telefone=?, genero=?, data_agendamento=?, cpf=? WHERE id=? AND clinica_id=?`,
      [nome, email, telefone, genero, data_agendamento, cpf, agendamentoId, clinicaId]
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

// =============================================================================
// 6. BUSCAR UM AGENDAMENTO ESPECÍFICO (Para a Gaveta de Prontuário)
// =============================================================================
exports.obterDetalhesAgendamento = async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: "Sessão inválida." });
  }

  const { id } = req.params;
  const clinicaId = req.usuario.clinica_id;

  try {
    // ALTERADO: Removido 'a.observacoes' que estava quebrando e adicionado '' AS observacoes para manter o front seguro
    const sql = `
      SELECT
        a.id, a.nome, a.cpf, a.email, a.telefone, a.tipo_terapia,
        a.motivo_consulta, '' AS observacoes, a.status_agendamento, a.data_agendamento,
        p.idade, p.peso, p.altura, p.genero, p.condicoes_preexistentes AS condicoes
      FROM agendamentos a
      INNER JOIN pacientes p ON a.paciente_id = p.id
      WHERE a.id = ? AND a.clinica_id = ?
    `;
    const [resultado] = await db.query(sql, [id, clinicaId]);

    if (resultado.length === 0) {
      return res.status(404).json({ erro: 'Agendamento/Prontuário não encontrado.' });
    }

    const ag = resultado[0];

    // Formata a resposta para o front-end
    res.json({
      ...ag,
      data_formatada: new Date(ag.data_agendamento).toLocaleDateString('pt-BR'),
      hora_formatada: new Date(ag.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });

  } catch (err) {
    console.error("Erro interno no controller ao obter prontuário:", err);
    res.status(500).json({ erro: 'Erro interno ao buscar dados do banco.' });
  }
};