const db = require('../config/db');
const agendaService = require('../services/agendaService');
const notificationService = require('../services/notificationService');
const crypto = require('crypto'); // <--- ADICIONE ESTA LINHA AQUI
// Função para renderizar a página principal do portal
exports.renderPortal = async (req, res) => {
  const { slug } = req.params;
  const pId = req.session.pacienteId; // Tentamos pegar o ID da sessão atual

  try {
    const [clinica] = await db.execute('SELECT * FROM clinicas WHERE slug = ?', [slug]);
    if (clinica.length === 0) return res.status(404).send("Clínica não encontrada");

    const [config] = await db.execute('SELECT * FROM clinica_configuracoes WHERE clinica_id = ?', [clinica[0].id]);

    // BUSCA OS DADOS DO PACIENTE SE ELE ESTIVER LOGADO
    let pacienteLogado = null;
    if (pId) {
      const [pacientes] = await db.execute('SELECT nome, email, telefone, cpf, data_nascimento, genero FROM pacientes WHERE id = ?', [pId]);
      pacienteLogado = pacientes[0] || null;
    }

    res.render('portalagendamento', {
      clinica: clinica[0],
      config: config[0] || {},
      pacienteLogado: pacienteLogado, // Passamos isso para o EJS
      layout: false
    });
  } catch (error) {
    console.error("Erro ao renderizar portal:", error);
    res.status(500).send("Erro interno ao carregar o portal.");
  }
};

// Função para buscar horários disponíveis (API)
exports.getHorariosLivres = async (req, res) => {
  const { clinica_id, data } = req.query;
  try {
    const [config] = await db.execute('SELECT * FROM clinica_configuracoes WHERE clinica_id = ?', [clinica_id]);

    // Buscamos agendamentos que não estejam cancelados
    const [ocupados] = await db.execute(
      `SELECT data_agendamento FROM agendamentos
             WHERE clinica_id = ? AND DATE(data_agendamento) = ?
             AND status_agendamento != 'cancelado'`,
      [clinica_id, data]
    );

    const disponiveis = agendaService.gerarSlotsDisponiveis(config[0], ocupados);
    res.json({ success: true, horarios: disponiveis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// A "Mágica": Cria o paciente e depois o agendamento
exports.criarAgendamento = async (req, res) => {
  const {
    clinica_id, nome, email, telefone, cpf, data, horario,
    genero, data_nascimento, tipo_terapia, motivo_consulta
  } = req.body;

  const connection = await db.getConnection();
  // Gera um novo token para este agendamento específico
  const novoToken = crypto.randomBytes(32).toString('hex');
  const novaExpiracao = new Date();
  novaExpiracao.setDate(novaExpiracao.getDate() + 30); // Token válido por 30 dias

  try {
    await connection.beginTransaction();

    const [configuracoes] = await connection.execute(
      'SELECT valor_sinal FROM clinica_configuracoes WHERE clinica_id = ?',
      [clinica_id]
    );
    const valorSinalDinamico = (configuracoes.length > 0 && configuracoes[0].valor_sinal) ? configuracoes[0].valor_sinal : 0.00;

    // 2. BUSCAR OU CRIAR O PACIENTE (Atualizando o token sempre)
    let pacienteId;
    const [pacientesExistentes] = await connection.execute(
      'SELECT id FROM pacientes WHERE cpf = ? AND clinica_id = ? LIMIT 1',
      [cpf, clinica_id]
    );

    if (pacientesExistentes.length > 0) {
      pacienteId = pacientesExistentes[0].id;
      await connection.execute(
        'UPDATE pacientes SET email = ?, telefone = ?, nome = ?, token_acesso = ?, token_expiracao = ? WHERE id = ?',
        [email, telefone, nome, novoToken, novaExpiracao, pacienteId]
      );
    } else {
      const [resPaciente] = await connection.execute(
        `INSERT INTO pacientes (clinica_id, nome, email, telefone, cpf, origem, token_acesso, token_expiracao) 
         VALUES (?, ?, ?, ?, ?, 'portal', ?, ?)`,
        [clinica_id, nome, email, telefone, cpf, novoToken, novaExpiracao]
      );
      pacienteId = resPaciente.insertId;
    }

    // 3. BUSCAR USUÁRIO ADMIN
    const [usuarios] = await connection.execute('SELECT id FROM usuarios WHERE clinica_id = ? LIMIT 1', [clinica_id]);
    const adminId = usuarios.length > 0 ? usuarios[0].id : null;
    if (!adminId) throw new Error("Clínica sem usuário administrador configurado.");

    // 4. CRIAR O AGENDAMENTO
    const dataAgendamentoCompleta = `${data} ${horario}`;
    const [resAgendamento] = await connection.execute(
      `INSERT INTO agendamentos (clinica_id, paciente_id, usuario_id, data_agendamento, status_agendamento, motivo_consulta, nome, email, telefone, cpf, tipo_terapia) 
       VALUES (?, ?, ?, ?, 'aguardando_sinal', ?, ?, ?, ?, ?, ?)`,
      [clinica_id, pacienteId, adminId, dataAgendamentoCompleta, motivo_consulta, nome, email, telefone, cpf, tipo_terapia]
    );

    // 5. FINANCEIRO
    await connection.execute(
      'INSERT INTO financeiro (clinica_id, paciente_id, agendamento_id, tipo, valor, data_vencimento, status_pagamento, descricao) VALUES (?, ?, ?, "receita", ?, ?, "aberto", ?)',
      [clinica_id, pacienteId, resAgendamento.insertId, valorSinalDinamico, data, `Sinal - ${nome}`]
    );

    await connection.commit();

    // --- NOTIFICAÇÃO ---
    const [clinicaResult] = await db.execute('SELECT * FROM clinicas WHERE id = ?', [clinica_id]);

    // Passamos o token criado aqui para o serviço de notificação
    // No seu portalController.js, dentro da função criarAgendamento:
    const dadosParaEmail = {
      nome: nome,
      email: email,
      tipo_terapia: tipo_terapia || 'Terapia Integrativa',
      data_agendamento: dataAgendamentoCompleta,
      motivo_consulta: motivo_consulta || 'Consulta inicial',
      token_acesso: novoToken // <--- ISSO É O MAIS IMPORTANTE
    };

    await notificationService.sendEmailNotification(clinicaResult[0], dadosParaEmail);

    return res.json({ success: true, message: "Agendamento realizado!" });

  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: "Erro ao processar." });
  } finally {
    if (connection) connection.release();
  }
};

