const db = require('../config/db');
const agendaService = require('../services/agendaService');
const notificationService = require('../services/notificationService');
const crypto = require('crypto');

// =============================================================================
// 1. RENDERIZAR PORTAL PRINCIPAL
// =============================================================================
exports.renderPortal = async (req, res) => {
  const { slug } = req.params;

  try {
    const [clinica] = await db.execute('SELECT * FROM clinicas WHERE slug = ?', [slug]);
    if (clinica.length === 0) return res.status(404).send("Clínica não encontrada");

    const clinicaAtual = clinica[0];

    const [config] = await db.execute(
      'SELECT * FROM clinica_configuracoes WHERE clinica_id = ? ORDER BY id DESC LIMIT 1',
      [clinicaAtual.id]
    );

    res.render('portalagendamento', {
      clinica: clinicaAtual,
      config: config[0] || {},
      pacienteLogado: null,
      layout: false
    });
  } catch (error) {
    console.error("Erro ao renderizar portal:", error);
    res.status(500).send("Erro interno ao carregar o portal.");
  }
};

// =============================================================================
// 2. BUSCAR HORÁRIOS DISPONÍVEIS (API)
// =============================================================================
exports.getHorariosLivres = async (req, res) => {
  const clinica_id = req.clinicaId;
  const { data } = req.query;
  if (!clinica_id || !data) return res.status(400).json({ success: false, message: "Parâmetros inválidos." });

  const connection = await db.getConnection();
  try {
    const [config] = await connection.execute(
      'SELECT * FROM clinica_configuracoes WHERE clinica_id = ? ORDER BY id DESC LIMIT 1',
      [clinica_id]
    );

    if (config.length === 0) {
      return res.status(404).json({ success: false, message: "Configurações da clínica não encontradas." });
    }

    const [ocupados] = await connection.execute(
      `SELECT data_agendamento 
       FROM agendamentos
       WHERE clinica_id = ? 
       AND DATE(CONVERT_TZ(data_agendamento, '+00:00', '-03:00')) = ?
       AND status_agendamento != 'cancelado'`,
      [clinica_id, data]
    );

    const disponiveis = agendaService.gerarSlotsDisponiveis(config[0], ocupados, data);
    res.json({ success: true, horarios: disponiveis });

  } catch (error) {
    console.error("Erro ao buscar horários livres no portal:", error);
    res.status(500).json({ success: false, message: "Erro interno ao processar agenda." });
  } finally {
    connection.release();
  }
};

// =============================================================================
// 3. CRIAR AGENDAMENTO (COM VÍNCULO DO PROFISSIONAL)
// =============================================================================
const PAGAMENTO_PLATAFORMA_ATIVO = false;

async function gerarLinkPagamentoPlataforma({ agendamentoId, valor, nome, email }) {
  throw new Error("Integração com a plataforma de pagamento ainda não configurada.");
}

exports.criarAgendamento = async (req, res) => {
  const clinica_id = req.clinicaId;
  const {
    nome, email, telefone, cpf, data, horario,
    genero, data_nascimento, tipo_terapia, motivo_consulta, aceite_lgpd,
    usuario_id, // 🌟 Captura o ID do profissional escolhido no select do portal
    forma_pagamento
  } = req.body;

  if (!clinica_id) {
    return res.status(401).json({ success: false, message: "Clínica não identificada." });
  }

  if (!aceite_lgpd || aceite_lgpd === 'false' || aceite_lgpd === false || aceite_lgpd === '0') {
    return res.status(400).json({ success: false, message: 'O consentimento da LGPD é obrigatório para realizar o agendamento.' });
  }

  const connection = await db.getConnection();

  const novoToken = crypto.randomBytes(32).toString('hex');
  const novaExpiracao = new Date();
  novaExpiracao.setDate(novaExpiracao.getDate() + 30);

  const pagamentoViaPlataforma = PAGAMENTO_PLATAFORMA_ATIVO && forma_pagamento === 'plataforma';

  try {
    await connection.query("SET time_zone = '-03:00'");
    await connection.beginTransaction();

    const [configuracoes] = await connection.execute(
      'SELECT * FROM clinica_configuracoes WHERE clinica_id = ? ORDER BY id DESC LIMIT 1',
      [clinica_id]
    );

    if (configuracoes.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Configurações da clínica não encontradas." });
    }

    const config = configuracoes[0];

    const diasPermitidos = (config.dias_semana || '1,2,3,4,5').split(',').map(d => d.trim());
    const diaSemana = new Date(data + 'T12:00:00').getDay().toString();
    if (!diasPermitidos.includes(diaSemana)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "A clínica não atende neste dia da semana." });
    }

    let periodosFechados = [];
    try {
      periodosFechados = typeof config.periodos_fechados === 'string'
        ? JSON.parse(config.periodos_fechados || '[]')
        : (config.periodos_fechados || []);
    } catch (e) {
      periodosFechados = [];
    }

    const dataAlvo = new Date(data + 'T00:00:00');
    const emRecesso = periodosFechados.some(p => {
      const inicio = new Date(p.inicio + 'T00:00:00');
      const fim = new Date(p.fim + 'T00:00:00');
      return dataAlvo >= inicio && dataAlvo <= fim;
    });

    if (emRecesso) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "A clínica está fechada nesta data (recesso/feriado)." });
    }

    const valorSinalDinamico = parseFloat(config.valor_sinal ? config.valor_sinal : 0.00);

    // BUSCAR OU CRIAR O PACIENTE
    let pacienteId;
    const [pacientesExistentes] = await connection.execute(
      'SELECT id FROM pacientes WHERE cpf = ? AND clinica_id = ? LIMIT 1',
      [cpf, clinica_id]
    );

    if (pacientesExistentes.length > 0) {
      pacienteId = pacientesExistentes[0].id;
      await connection.execute(
        `UPDATE pacientes SET 
         email = ?, telefone = ?, nome = ?, token_acesso = ?, token_expiracao = ?, 
         aceite_lgpd = 1, data_aceite_lgpd = NOW() 
        WHERE id = ?`,
        [email, telefone, nome, novoToken, novaExpiracao, pacienteId]
      );
    } else {
      const [resPaciente] = await connection.execute(
        `INSERT INTO pacientes (clinica_id, nome, email, telefone, cpf, origem, token_acesso, token_expiracao, aceite_lgpd, data_aceite_lgpd) 
        VALUES (?, ?, ?, ?, ?, 'portal', ?, ?, 1, NOW())`,
        [clinica_id, nome, email, telefone, cpf, novoToken, novaExpiracao]
      );
      pacienteId = resPaciente.insertId;
    }

    // 🌟 DEFINIR O PROFISSIONAL RESPONSÁVEL (Usa o escolhido ou pega o primeiro como fallback)
    let profissionalIdFinal = usuario_id;
    if (!profissionalIdFinal) {
      const [usuariosAdmin] = await connection.execute('SELECT id FROM usuarios WHERE clinica_id = ? LIMIT 1', [clinica_id]);
      profissionalIdFinal = usuariosAdmin.length > 0 ? usuariosAdmin[0].id : null;
    }

    if (!profissionalIdFinal) {
      throw new Error("Nenhum profissional configurado para esta clínica.");
    }

    const statusInicial = 'aguardando_sinal';
    const dataAgendamentoCompleta = `${data} ${horario}`;

    // CRIAR O AGENDAMENTO COM O ID DO PROFISSIONAL
    const [resAgendamento] = await connection.execute(
      `INSERT INTO agendamentos (clinica_id, paciente_id, usuario_id, data_agendamento, status_agendamento, motivo_consulta, nome, email, telefone, cpf, tipo_terapia) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clinica_id, pacienteId, profissionalIdFinal, dataAgendamentoCompleta, statusInicial, motivo_consulta, nome, email, telefone, cpf, tipo_terapia]
    );
    const agendamentoId = resAgendamento.insertId;

    // REGISTRO NO FINANCEIRO
    const descricaoFinanceira = `Sinal - ${nome}`;
    await connection.execute(
      `INSERT INTO financeiro 
       (clinica_id, paciente_id, agendamento_id, tipo, categoria, valor, data_vencimento, status_pagamento, descricao, observacoes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clinica_id,
        pacienteId,
        agendamentoId,
        'receita',
        'Consulta',
        valorSinalDinamico,
        data,
        'aberto',
        descricaoFinanceira,
        'Sinal gerado automaticamente pelo portal público.'
      ]
    );

    req.session.pacienteId = pacienteId;
    await connection.commit();

    // Notificação interna
    try {
      const { criarNotificacao } = require('../services/notificationServiceClientExterno');
      await criarNotificacao({
        clinicaId: clinica_id,
        tipo: 'agendamento',
        titulo: 'Novo agendamento',
        mensagem: `${nome} agendou uma consulta para ${data} às ${horario}`,
        referenciaId: agendamentoId,
        pacienteId: pacienteId
      });
    } catch (notifErr) {
      console.error('Erro ao criar notificação interna:', notifErr);
    }

    // Disparo de e-mail
    const [clinicaResult] = await db.execute('SELECT * FROM clinicas WHERE id = ?', [clinica_id]);
    const dadosParaEmail = {
      nome: nome,
      email: email,
      tipo_terapia: tipo_terapia || 'Terapia Integrativa',
      data_agendamento: dataAgendamentoCompleta,
      motivo_consulta: motivo_consulta || 'Consulta inicial',
      token_acesso: novoToken
    };

    notificationService.sendEmailNotification(clinicaResult[0], dadosParaEmail)
      .catch(err => console.error("Erro ao enviar email:", err));

    return res.json({
      success: true,
      requiresPayment: false,
      message: "Agendamento realizado com sucesso!"
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Erro ao criar agendamento via portal:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Esse horário acabou de ser reservado por outra pessoa. Por favor, escolha outro horário.'
      });
    }
    res.status(500).json({ success: false, message: "Erro ao processar o agendamento." });
  } finally {
    if (connection) connection.release();
  }
};

// =============================================================================
// 4. LISTAR PROFISSIONAIS DA CLÍNICA PARA O PORTAL PÚBLICO
// =============================================================================
exports.getUsuariosClinica = async (req, res) => {
  const clinica_id = req.clinicaId; // Injetado pelo portalMiddleware via slug
  if (!clinica_id) return res.status(400).json({ success: false, message: "Clínica não encontrada." });

  try {
    const [usuarios] = await db.execute(
      'SELECT id, nome, cargo FROM usuarios WHERE clinica_id = ?',
      [clinica_id]
    );
    res.json(usuarios);
  } catch (error) {
    console.error("Erro ao listar profissionais no portal:", error);
    res.status(500).json({ success: false, message: "Erro interno ao buscar profissionais." });
  }
};