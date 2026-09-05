const db = require('../config/db');
const agendaService = require('../services/agendaService');
const notificationService = require('../services/notificationService');
const crypto = require('crypto');

// =============================================================================
// 1. RENDERIZAR PORTAL PRINCIPAL
// =============================================================================
// exports.renderPortal = async (req, res) => {
//   const { slug } = req.params;
//   const pId = req.session.pacienteId;

//   try {
//     // 1. Busca a clínica pelo slug
//     const [clinica] = await db.execute('SELECT * FROM clinicas WHERE slug = ?', [slug]);
//     if (clinica.length === 0) return res.status(404).send("Clínica não encontrada");

//     const clinicaAtual = clinica[0];

//     // 2. Busca configurações
//     const [config] = await db.execute('SELECT * FROM clinica_configuracoes WHERE clinica_id = ?', [clinicaAtual.id]);

//     // 3. Validação do Paciente Logado na Sessão
//     let pacienteLogado = null;
//     if (pId) {
//       // Adicionamos a verificação 'AND clinica_id = ?' para garantir que o paciente é desta clínica
//       const [pacientes] = await db.execute(
//         'SELECT nome, email, telefone, cpf, data_nascimento, genero FROM pacientes WHERE id = ? AND clinica_id = ?',
//         [pId, clinicaAtual.id]
//       );

//       // Se não encontrou (ou pertence a outra clínica), limpamos a sessão para não exibir dados errados
//       if (pacientes.length > 0) {
//         pacienteLogado = pacientes[0];
//       } else {
//         req.session.pacienteId = null; // Limpa a sessão corrompida
//       }
//     }

//     res.render('portalagendamento', {
//       clinica: clinicaAtual,
//       config: config[0] || {},
//       pacienteLogado: pacienteLogado,
//       layout: false
//     });
//   } catch (error) {
//     console.error("Erro ao renderizar portal:", error);
//     res.status(500).send("Erro interno ao carregar o portal.");
//   }
// };
// novo render portal
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

    // Sempre null → paciente preenche manualmente
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
  // O clinica_id NUNCA deve vir do que o paciente manda — vem do middleware
  // (portalPacienteMiddleware), que já validou o slug contra o banco.
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

    // Agora passamos "data" como terceiro argumento
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
// 3. CRIAR AGENDAMENTO (A Mágica do Portal)
// =============================================================================
//
// REGRA DE NEGÓCIO ATUAL (temporária):
//   O sinal/pagamento antecipado está DESATIVADO como trava de agendamento —
//   o paciente consegue concluir o agendamento pelo portal sem precisar pagar
//   nada no momento da marcação (o agendamento já nasce 'confirmado').
//   Mesmo assim, o financeiro da clínica sempre recebe um lançamento com o
//   valor do sinal configurado e status_pagamento = 'aberto' (não pago), para
//   a clínica ter visibilidade e decidir se vai cobrar o paciente depois ou
//   simplesmente ignorar essa cobrança. O portal não bloqueia nada por causa
//   disso — é só um registro informativo.
//
// PREVISTO PARA O FUTURO:
//   Quando `forma_pagamento === 'plataforma'` chegar do front-end, o fluxo vai
//   criar o agendamento com status 'aguardando_sinal' (já existe no ENUM do
//   banco — reaproveitado aqui com o sentido de "aguardando confirmação do
//   pagamento"), gerar um link na plataforma de pagamento segura (gateway) e
//   devolver `redirectUrl` para o front-end redirecionar o paciente. Isso está
//   deixado como placeholder (`gerarLinkPagamentoPlataforma`) para quando o
//   gateway for integrado — por enquanto essa função nunca é chamada porque
//   `PAGAMENTO_PLATAFORMA_ATIVO` está `false`.
//
// IMPORTANTE: o ENUM `status_agendamento` no init.sql só aceita
//   'aguardando_sinal' | 'confirmado' | 'cancelado' | 'finalizado' | 'nao_compareceu'
//   Não existe 'pendente' nem 'aguardando_pagamento' nesse ENUM — por isso o
//   código abaixo usa exclusivamente esses 5 valores. Se um dia você quiser um
//   status dedicado tipo 'pendente', precisa rodar um ALTER TABLE no banco
//   antes de usar essa string aqui.
// =============================================================================

const PAGAMENTO_PLATAFORMA_ATIVO = false; // TODO: ligar quando o gateway estiver configurado

// Placeholder para a futura integração com o gateway de pagamento.
// Quando implementado, deve criar a cobrança e retornar a URL de checkout.
async function gerarLinkPagamentoPlataforma({ agendamentoId, valor, nome, email }) {
  // TODO: integrar com o gateway (ex: Mercado Pago, Stripe, PagSeguro...)
  // Deve retornar algo como: { url: 'https://checkout.gateway.com/xyz' }
  throw new Error("Integração com a plataforma de pagamento ainda não configurada.");
}

exports.criarAgendamento = async (req, res) => {
  // O clinica_id NUNCA deve vir do que o paciente manda no body — vem do
  // middleware (portalPacienteMiddleware), que já validou o slug contra o
  // banco. Se alguém adulterar o clinica_id no payload, é ignorado.
  const clinica_id = req.clinicaId;
  const {
    nome, email, telefone, cpf, data, horario,
    genero, data_nascimento, tipo_terapia, motivo_consulta, aceite_lgpd,// <-- Captura o aceite vindo do portal
    forma_pagamento // 'plataforma' (futuro) — qualquer outro valor/ausente = sem sinal
  } = req.body;

  if (!clinica_id) {
    return res.status(401).json({ success: false, message: "Clínica não identificada." });
  }
  // 🛡️ Trava de segurança LGPD
  if (!aceite_lgpd || aceite_lgpd === 'false' || aceite_lgpd === false || aceite_lgpd === '0') {
    return res.status(400).json({ success: false, message: 'O consentimento da LGPD é obrigatório para realizar o agendamento.' });
  }

  const connection = await db.getConnection();

  // Gera um novo token para este agendamento específico
  const novoToken = crypto.randomBytes(32).toString('hex');
  const novaExpiracao = new Date();
  novaExpiracao.setDate(novaExpiracao.getDate() + 30); // Token válido por 30 dias

  // Enquanto o gateway não estiver ligado, ignoramos o que vier em forma_pagamento
  // e sempre seguimos pelo fluxo sem sinal.
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

    // ── Validação: dia da semana permitido ──
    const diasPermitidos = (config.dias_semana || '1,2,3,4,5').split(',').map(d => d.trim());
    const diaSemana = new Date(data + 'T12:00:00').getDay().toString();
    if (!diasPermitidos.includes(diaSemana)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "A clínica não atende neste dia da semana." });
    }

    // ── Validação: não está dentro de um recesso/feriado ──
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

    // ── Validação: horário não cai em intervalo de pausa (almoço etc.) ──
    let intervalosPausa = [];
    try {
      intervalosPausa = typeof config.intervalos_pausa === 'string'
        ? JSON.parse(config.intervalos_pausa || '[]')
        : (config.intervalos_pausa || []);
    } catch (e) {
      intervalosPausa = [];
    }

    const horaParaMinutos = (horaStr) => {
      if (!horaStr) return null;
      const [h, m] = String(horaStr).slice(0, 5).split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    const duracaoAtend = parseInt(config.duracao_atendimento, 10) || 30;
    const inicioSlot = horaParaMinutos(horario);
    if (inicioSlot !== null && Array.isArray(intervalosPausa)) {
      const fimSlot = inicioSlot + duracaoAtend;
      const emPausa = intervalosPausa.some((p) => {
        const iniP = horaParaMinutos(p.inicio);
        const fimP = horaParaMinutos(p.fim);
        if (iniP === null || fimP === null) return false;
        return inicioSlot < fimP && fimSlot > iniP;
      });
      if (emPausa) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Este horário está em um intervalo de pausa da clínica (ex.: almoço)."
        });
      }
    }

    // Converte para float para garantir cálculos matemáticos corretos
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

    // BUSCAR USUÁRIO ADMIN
    const [usuarios] = await connection.execute('SELECT id FROM usuarios WHERE clinica_id = ? LIMIT 1', [clinica_id]);
    const adminId = usuarios.length > 0 ? usuarios[0].id : null;
    if (!adminId) throw new Error("Clínica sem usuário administrador configurado.");

    // ── Define o status inicial do agendamento ──
    // Fluxo atual (sem gateway): sempre 'aguardando_sinal'
    // Fluxo futuro (com gateway): também 'aguardando_sinal' até o webhook confirmar
    const statusInicial = 'aguardando_sinal';

    // CRIAR O AGENDAMENTO
    const dataAgendamentoCompleta = `${data} ${horario}`;
    const [resAgendamento] = await connection.execute(
      `INSERT INTO agendamentos (clinica_id, paciente_id, usuario_id, data_agendamento, status_agendamento, motivo_consulta, nome, email, telefone, cpf, tipo_terapia) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clinica_id, pacienteId, adminId, dataAgendamentoCompleta, statusInicial, motivo_consulta, nome, email, telefone, cpf, tipo_terapia]
    );
    const agendamentoId = resAgendamento.insertId;

    // REGISTRO NO FINANCEIRO
    // O agendamento é criado independente do sinal ser pago ou não. Mas o
    // financeiro da clínica precisa refletir isso: sempre criamos o lançamento
    // com status_pagamento = 'aberto' (não pago), para a clínica ter o dado
    // visível no dashboard e decidir se vai cobrar o paciente depois ou não —
    // essa decisão fica de fora do fluxo do portal.
    const descricaoFinanceira = pagamentoViaPlataforma
      ? `Sinal (plataforma) - ${nome}`
      : `Sinal - ${nome}`;

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
        'Sinal não pago no momento do agendamento online. Cobrança fica a critério da clínica.'
      ]
    );

    // ── (Futuro) Geração do link de pagamento na plataforma ──
    let redirectUrl = null;
    if (pagamentoViaPlataforma) {
      try {
        const linkPagamento = await gerarLinkPagamentoPlataforma({
          agendamentoId,
          valor: valorSinalDinamico,
          nome,
          email
        });
        redirectUrl = linkPagamento.url;
      } catch (gatewayError) {
        // Se o gateway falhar, não travamos o agendamento: ele já foi criado
        // como 'aguardando_pagamento' e pode ser tratado manualmente pela clínica.
        console.error("Erro ao gerar link de pagamento na plataforma:", gatewayError);
      }
    }

    // Mantém o paciente "logado" no portal via sessão, para que da próxima vez
    // que ele voltar o formulário já venha pré-preenchido (ver renderPortal).
    req.session.pacienteId = pacienteId;

    await connection.commit();

    // Notificação interna no dashboard (sino)
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

    // DISPARO DE NOTIFICAÇÃO
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

    // ── Resposta ──
    // requiresPayment indica ao front-end se ele deve redirecionar o paciente
    // para a plataforma de pagamento. Hoje sempre volta `false` porque o
    // gateway está desligado (PAGAMENTO_PLATAFORMA_ATIVO = false).
    if (pagamentoViaPlataforma && redirectUrl) {
      return res.json({
        success: true,
        requiresPayment: true,
        redirectUrl,
        message: "Agendamento criado. Redirecionando para o pagamento."
      });
    }

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