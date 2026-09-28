const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const financeiroController = require('./financeiroController');

const notificationService = require('../services/notificationService');
const whatsappAgendaService = require('../services/whatsappAgendaService');
const whatsappService = require('../services/whatsappService');

const uploadDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Monta mensagem de confirmação de agendamento elegante para WhatsApp.
 */
function montarMensagemConfirmacaoAgendamento({
  nomeClinica,
  dataAgendamento,
  tipoTerapia,
  motivoConsulta
}) {
  const dataObj = new Date(dataAgendamento);

  const dataExtenso = dataObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const hora = dataObj.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Capitaliza a primeira letra do dia da semana (ex: "segunda-feira" → "Segunda-feira")
  const dataCapitalizada = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  const tipo = (tipoTerapia || 'Consulta').trim();
  const motivo = (motivoConsulta || '').trim();

  let blocoMotivo = '';
  if (motivo) {
    blocoMotivo = `\n📝 *Motivo:* ${motivo}\n`;
  }

  return (
`✨ *Agendamento confirmado!*

Olá, *{{nome_paciente}}*! 👋

É um prazer tê-lo(a) conosco. Seu horário na *${nomeClinica}* foi reservado com sucesso.

━━━━━━━━━━━━━━━━
📅 *Data:* ${dataCapitalizada}
🕐 *Horário:* ${hora}
🩺 *Atendimento:* ${tipo}${blocoMotivo}━━━━━━━━━━━━━━━━

✅ *O que fazer agora?*
• Anote a data e o horário
• Chegue com alguns minutos de antecedência
• Em caso de imprevisto, avise com antecedência

Se precisar *remarcar* ou *cancelar*, é só responder esta mensagem ou entrar em contato com a clínica.

Estamos à disposição e ansiosos para recebê-lo(a)! 💚

Com carinho,
*Equipe ${nomeClinica}*`
  );
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
    data_agendamento, motivo_consulta, origem_indicacao, observacoes, aceite_lgpd,
    valor_sinal, usuario_id
  } = req.body;

  const profissionalIdFinal = usuario_id || (req.usuario ? req.usuario.id : null);
  if (!profissionalIdFinal) {
    return res.status(400).json({ mensagem: 'O profissional responsável deve ser selecionado.' });
  }

  if (!aceite_lgpd || aceite_lgpd === 'false' || aceite_lgpd === false || aceite_lgpd === '0') {
    return res.status(400).json({ mensagem: 'O consentimento da LGPD é obrigatório para realizar o agendamento.' });
  }

  if (data_agendamento) {
    data_agendamento = data_agendamento.replace('T', ' ').replace('Z', '').split('.')[0];
  }

  if (data_nascimento) {
    const nascimento = new Date(data_nascimento);
    const hoje = new Date();
    let idadeCalculada = hoje.getFullYear() - nascimento.getFullYear();
    const mesAtual = hoje.getMonth() - nascimento.getMonth();
    if (mesAtual < 0 || (mesAtual === 0 && hoje.getDate() < nascimento.getDate())) {
      idadeCalculada--;
    }
    idade = idadeCalculada;
  }

  const clinicaId = req.usuario ? req.usuario.clinica_id : null;

  const patientPhoto = req.files && req.files['patient_photo'] ? req.files['patient_photo'][0] : null;
  const anexos = (req.files && req.files['anexos']) || [];
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
          token_acesso = ?, token_expiracao = ?,
          aceite_lgpd = 1, data_aceite_lgpd = NOW()
         WHERE id = ?`,
        [telefone, email, peso, altura, idade, tipo_sanguineo, genero, condicoesString, novoToken, dataExpiracao, paciente_id]
      );
    } else {
      const [novoPacResult] = await connection.query(
        `INSERT INTO pacientes (
          clinica_id, nome, cpf, email, telefone, data_nascimento,
          idade, tipo_sanguineo, peso, altura, genero,
          condicoes_preexistentes, foto_perfil, status_pagamento, token_acesso, token_expiracao,
          aceite_lgpd, data_aceite_lgpd
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, 1, NOW())`,
        [clinicaId, nome, cpf, email, telefone, data_nascimento, idade, tipo_sanguineo, peso, altura, genero, condicoesString, fotoPerfilFilename, novoToken, dataExpiracao]
      );
      paciente_id = novoPacResult.insertId;
    }

    const sqlAgendamento = `
      INSERT INTO agendamentos (
        clinica_id, paciente_id, usuario_id, nome, data_agendamento,
        tipo_terapia, motivo_consulta, origem_indicacao, status_agendamento,
        peso, genero, altura, data_nascimento, idade, tipo_sanguineo, email, telefone, cpf, condicoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresAgendamento = [
      clinicaId, paciente_id, profissionalIdFinal, nome, data_agendamento,
      tipo_terapia, motivo_consulta, origem_indicacao, 'aguardando_sinal',
      peso || null, genero || null, altura || null, data_nascimento || null, idade || null,
      tipo_sanguineo || null, email || null, telefone || null, cpf, condicoesString
    ];

    const [agendamentoResult] = await connection.query(sqlAgendamento, valoresAgendamento);
    const agendamentoId = agendamentoResult.insertId;

    let valorLimpo = 0.00;
    if (valor_sinal) {
      valorLimpo = parseFloat(String(valor_sinal).replace(/\./g, '').replace(',', '.'));
    }

    const dataLocal = new Date();
    const ano = dataLocal.getFullYear();
    const mes = String(dataLocal.getMonth() + 1).padStart(2, '0');
    const dia = String(dataLocal.getDate()).padStart(2, '0');
    const dataVencimentoReal = `${ano}-${mes}-${dia}`;

    await connection.query(
      `INSERT INTO financeiro (clinica_id, paciente_id, agendamento_id, tipo, descricao, valor, data_vencimento, status_pagamento) 
       VALUES (?, ?, ?, 'receita', ?, ?, ?, 'aberto')`,
      [
        clinicaId,
        paciente_id,
        agendamentoId,
        valorLimpo > 0 ? `Sinal de Consulta - ${nome}` : `Consulta Agendada - ${nome}`,
        valorLimpo,
        dataVencimentoReal
      ]
    );

    if (anexos.length > 0) {
      for (const file of anexos) {
        await connection.query(
          `INSERT INTO anexos (clinica_id, paciente_id, agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [clinicaId, paciente_id, agendamentoId, file.originalname, file.filename, file.mimetype, file.size]
        );
      }
    }

    await connection.commit();
    console.log(`[AGENDAMENTO] Transação confirmada com sucesso para o ID: ${agendamentoId}`);

    // ─── NOTIFICAÇÕES (não bloqueiam a resposta) ───
    try {
      const [clinicaResult] = await connection.query(
        'SELECT id, nome_clinica, telefone_clinica, whatsapp_creditos FROM clinicas WHERE id = ?',
        [clinicaId]
      );
      const dadosDaClinica = clinicaResult[0];

      if (!dadosDaClinica) {
        console.warn(`[MED-LM] ⚠️ Clínica ID ${clinicaId} não encontrada para notificações.`);
      }

      const [[pacienteDados]] = await connection.query(
        'SELECT nome, telefone FROM agendamentos WHERE id = ?',
        [agendamentoId]
      );

      // E-mail
      if (email && dadosDaClinica) {
        console.log(`[AGENDAMENTO] Preparando envio de e-mail para: ${email}`);
        const dadosDoAgendamento = {
          nome: nome,
          email: email,
          telefone: telefone,
          tipo_terapia: tipo_terapia,
          data_agendamento: data_agendamento,
          motivo_consulta: motivo_consulta,
          token_acesso: novoToken
        };

        notificationService.sendEmailNotification(dadosDaClinica, dadosDoAgendamento)
          .then(() => console.log(`[AGENDAMENTO] ✅ E-mail enviado com sucesso para ${email}`))
          .catch(emailErr => console.error("[MED-LM] ❌ Erro no envio de e-mail:", emailErr.message));
      }

      // WhatsApp — template elegante
      if (pacienteDados && pacienteDados.telefone && dadosDaClinica) {
        console.log(`[AGENDAMENTO] Iniciando disparo de WhatsApp para ${pacienteDados.nome} (${pacienteDados.telefone})...`);

        const mensagemTexto = montarMensagemConfirmacaoAgendamento({
          nomeClinica: dadosDaClinica.nome_clinica,
          dataAgendamento: data_agendamento,
          tipoTerapia: tipo_terapia,
          motivoConsulta: motivo_consulta
        });

        whatsappService
          .enviarWhatsApp(clinicaId, pacienteDados.telefone, mensagemTexto, pacienteDados.nome)
          .then(() => console.log(`[AGENDAMENTO] ✅ WhatsApp disparado e crédito abatido com sucesso!`))
          .catch(whatsErr => console.error(`[MED-LM] ❌ Falha no envio de WhatsApp:`, whatsErr.message));
      } else {
        console.log("[AGENDAMENTO] ℹ️ WhatsApp ignorado: paciente sem telefone ou dados da clínica incompletos.");
      }

    } catch (notifError) {
      console.error("[MED-LM] ❌ Erro geral ao processar notificações:", notifError.message);
    }

    return res.status(201).json({
      mensagem: 'Processado com sucesso!',
      agendamentoId
    });

  } catch (err) {
    if (connection) await connection.rollback();

    console.error("❌ ERRO DETALHADO AO CRIAR AGENDAMENTO:", err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        erro: 'Este horário já está ocupado por outro agendamento. Escolha outro horário.'
      });
    }

    res.status(500).json({ erro: 'Erro ao criar agendamento', detalhes: err.message });
  } finally {
    if (connection) connection.release();
  }
};

// =============================================================================
// 2. LISTAR AGENDAMENTOS
// =============================================================================
exports.listarAgendamentos = async (req, res) => {
  const clinicaId = req.usuario ? req.usuario.clinica_id : null;

  try {
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

    const agendamentoIds = agendamentos.map(a => a.id);
    const [anexos] = await db.query(
      'SELECT agendamento_id, nome_original, caminho_servidor, mime_type FROM anexos WHERE agendamento_id IN (?)',
      [agendamentoIds]
    );

    let totalMasculino = 0;
    let totalFeminino = 0;

    const dadosFormatados = agendamentos.map(ag => {
      if (ag.genero === 'Masculino') totalMasculino++;
      if (ag.genero === 'Feminino') totalFeminino++;

      return {
        ...ag,
        status_formatado: ag.status_agendamento.replace('_', ' ').toUpperCase(),
        data_ptbr: new Date(ag.data_agendamento).toLocaleString('pt-BR'),
        anexos: anexos.filter(an => an.agendamento_id === ag.id)
      };
    });

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

// =============================================================================
// 2.1 LISTA AGENDAMENTO DE HOJE
// =============================================================================
exports.listarAgendamentosHoje = async (req, res) => {
  const clinicaId = req.usuario ? req.usuario.clinica_id : null;

  const agoraLocal = new Date();
  const ano = agoraLocal.getFullYear();
  const mes = String(agoraLocal.getMonth() + 1).padStart(2, '0');
  const dia = String(agoraLocal.getDate()).padStart(2, '0');
  const hoje = `${ano}-${mes}-${dia}`;

  try {
    const sqlAgendamentosHoje = `
      SELECT
        a.*,
        f.status_pagamento AS financeiro_status
      FROM agendamentos a
      LEFT JOIN financeiro f ON a.id = f.agendamento_id
      WHERE a.clinica_id = ? 
      AND DATE(a.data_agendamento) = ?
      AND a.status_agendamento != 'cancelado'
      ORDER BY a.data_agendamento ASC
    `;

    const [agendamentos] = await db.query(sqlAgendamentosHoje, [clinicaId, hoje]);
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
  const clinicaId = req.usuario ? req.usuario.clinica_id : null;
  try {
    const { id } = req.params;
    const [agendamento] = await connection.query(
      'SELECT nome, email, tipo_terapia, data_agendamento FROM agendamentos WHERE id = ? AND clinica_id = ?',
      [id, clinicaId]
    );

    if (agendamento.length === 0) return res.status(404).json({ mensagem: 'Não encontrado.' });

    await connection.query('DELETE FROM agendamentos WHERE id = ? AND clinica_id = ?', [id, clinicaId]);

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
  const clinicaId = req.usuario ? req.usuario.clinica_id : null;
  let { nome, cpf, email, telefone, genero, data_agendamento } = req.body;
  const anexos = (req.files && req.files['anexos']) || [];

  if (data_agendamento) {
    data_agendamento = data_agendamento.replace('T', ' ').replace('Z', '').split('.')[0];
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [agendamentoAtual] = await connection.query(
      'SELECT paciente_id FROM agendamentos WHERE id = ? AND clinica_id = ?',
      [agendamentoId, clinicaId]
    );
    if (agendamentoAtual.length === 0) throw new Error('Acesso negado');

    const pacienteId = agendamentoAtual[0].paciente_id;

    await connection.query(
      `UPDATE agendamentos 
       SET nome=?, email=?, telefone=?, genero=?, data_agendamento=?, cpf=?, status_agendamento='aguardando_sinal' 
       WHERE id=? AND clinica_id=?`,
      [nome, email, telefone, genero, data_agendamento, cpf, agendamentoId, clinicaId]
    );

    if (anexos.length > 0) {
      for (const file of anexos) {
        await connection.query(
          'INSERT INTO anexos (clinica_id, paciente_id, agendamento_id, nome_original, caminho_servidor, mime_type, tamanho_bytes) VALUES (?,?,?,?,?,?,?)',
          [clinicaId, pacienteId, agendamentoId, file.originalname, file.filename, file.mimetype, file.size]
        );
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
  let { data_agendamento } = req.body;

  const clinicaId = req.clinicaId || (req.usuario ? req.usuario.clinica_id : null);

  if (!clinicaId) {
    return res.status(403).json({ erro: 'Acesso negado: Clínica não identificada.' });
  }

  if (data_agendamento && data_agendamento.includes('T')) {
    data_agendamento = data_agendamento.replace('T', ' ').substring(0, 19);
    if (data_agendamento.length === 16) data_agendamento += ':00';
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT id FROM agendamentos WHERE id = ? AND clinica_id = ? FOR UPDATE',
      [agendamentoId, clinicaId]
    );

    if (rows.length === 0) {
      throw new Error('Agendamento não encontrado ou não pertence a esta clínica.');
    }

    const [updateResult] = await connection.query(
      `UPDATE agendamentos 
       SET data_agendamento = ?, 
           status_agendamento = 'aguardando_sinal' 
       WHERE id = ? AND clinica_id = ?`,
      [data_agendamento, agendamentoId, clinicaId]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error('Agendamento não encontrado ou não pertence a esta clínica.');
    }

    await connection.query(
      "UPDATE financeiro SET status_pagamento = 'cancelado' WHERE agendamento_id = ? AND status_pagamento = 'aberto'",
      [agendamentoId]
    );

    const [financeiroExistente] = await connection.query(
      "SELECT id FROM financeiro WHERE agendamento_id = ? LIMIT 1",
      [agendamentoId]
    );

    const novaData = data_agendamento.split(' ')[0];

    if (financeiroExistente.length > 0) {
      await connection.query(
        `INSERT INTO financeiro (clinica_id, paciente_id, agendamento_id, tipo, descricao, valor, data_vencimento, status_pagamento) 
         SELECT clinica_id, paciente_id, agendamento_id, tipo, descricao, valor, ?, 'aberto' 
         FROM financeiro WHERE agendamento_id = ? LIMIT 1`,
        [novaData, agendamentoId]
      );
    } else {
      await connection.query(
        `INSERT INTO financeiro (clinica_id, paciente_id, agendamento_id, tipo, descricao, valor, data_vencimento, status_pagamento) 
         SELECT clinica_id, paciente_id, ?, 'receita', 'Consulta Reagendada', 0.00, ?, 'aberto' 
         FROM agendamentos WHERE id = ?`,
        [agendamentoId, novaData, agendamentoId]
      );
    }

    const [dados] = await connection.query(
      'SELECT nome, email, telefone, tipo_terapia FROM agendamentos WHERE id = ? AND clinica_id = ?',
      [agendamentoId, clinicaId]
    );

    await connection.commit();

    res.status(200).json({ mensagem: 'Reagendado com sucesso!' });

    if (dados.length > 0) {
      const pacienteInfo = dados[0];

      if (pacienteInfo.email) {
        notificationService.sendEmailNotification({ ...pacienteInfo, data_agendamento }, true)
          .catch(err => console.error('[MED-LM] Erro e-mail reagendamento:', err.message));
      }

      const [[clinicaDados]] = await db.query(
        'SELECT id, nome_clinica, telefone_clinica, whatsapp_creditos FROM clinicas WHERE id = ?',
        [clinicaId]
      );

      if (clinicaDados && pacienteInfo.telefone) {
        whatsappAgendaService
          .notificarAgendamentoWhatsApp(clinicaDados, pacienteInfo, { data_agendamento }, 'reagendado')
          .catch(err => console.error('[MED-LM] Erro no reagendamento via WhatsApp:', err.message));
      }
    }

  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ erro: err.message });
  } finally {
    connection.release();
  }
};

// =============================================================================
// 6. BUSCAR UM AGENDAMENTO ESPECÍFICO
// =============================================================================
exports.obterDetalhesAgendamento = async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: "Sessão inválida." });
  }

  const { id } = req.params;
  const clinicaId = req.usuario ? req.usuario.clinica_id : null;

  try {
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
