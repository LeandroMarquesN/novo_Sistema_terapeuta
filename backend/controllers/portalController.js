const db = require('../config/db');
const agendaService = require('../services/agendaService');
const notificationService = require('../services/notificationService');
// Função para renderizar a página principal do portal
exports.renderPortal = async (req, res) => {
  const { slug } = req.params;
  try {
    const [clinica] = await db.execute('SELECT * FROM clinicas WHERE slug = ?', [slug]);
    if (clinica.length === 0) return res.status(404).send("Clínica não encontrada");

    const [config] = await db.execute('SELECT * FROM clinica_configuracoes WHERE clinica_id = ?', [clinica[0].id]);

    res.render('portalagendamento', {
      clinica: clinica[0],
      config: config[0] || {},
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
// ... (mantenha os imports e as funções anteriores)

exports.criarAgendamento = async (req, res) => {
  const {
    clinica_id, nome, email, telefone, cpf, data, horario,
    genero, data_nascimento, tipo_terapia, motivo_consulta
  } = req.body;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. BUSCAR CONFIGURAÇÃO DA CLÍNICA (Valor do Sinal Dinâmico)
    const [configuracoes] = await connection.execute(
      'SELECT valor_sinal FROM clinica_configuracoes WHERE clinica_id = ?',
      [clinica_id]
    );

    // Se não encontrar configuração, define como 0.00 para não quebrar o banco
    const valorSinalDinamico = (configuracoes.length > 0 && configuracoes[0].valor_sinal)
      ? configuracoes[0].valor_sinal
      : 0.00;

    // 2. CRIAR OU LOCALIZAR O PACIENTE
    const [resPaciente] = await connection.execute(
      `INSERT INTO pacientes (clinica_id, nome, email, telefone, cpf) VALUES (?, ?, ?, ?, ?)`,
      [clinica_id, nome, email, telefone, cpf]
    );
    const pacienteId = resPaciente.insertId;

    // 3. BUSCAR USUÁRIO ADMIN DA CLÍNICA
    const [usuarios] = await connection.execute(
      'SELECT id FROM usuarios WHERE clinica_id = ? LIMIT 1',
      [clinica_id]
    );

    const adminId = usuarios.length > 0 ? usuarios[0].id : null;

    if (!adminId) {
      throw new Error("Clínica sem usuário administrador configurado.");
    }

    // 4. CRIAR O AGENDAMENTO (Usando o status correto do seu ENUM)
    const dataAgendamentoCompleta = `${data} ${horario}`;

    const [resAgendamento] = await connection.execute(
      `INSERT INTO agendamentos (
        clinica_id, paciente_id, usuario_id, data_agendamento,
        status_agendamento, motivo_consulta, nome, email, telefone, cpf, tipo_terapia
      ) VALUES (?, ?, ?, ?, 'aguardando_sinal', ?, ?, ?, ?, ?, ?)`,
      [
        clinica_id,
        pacienteId,
        adminId,
        dataAgendamentoCompleta,
        motivo_consulta,
        nome,
        email,
        telefone,
        cpf,
        tipo_terapia
      ]
    );
    const agendamentoId = resAgendamento.insertId;

    // 5. CRIAR LANÇAMENTO FINANCEIRO (Com valor dinâmico e tipo receita)
    await connection.execute(
      `INSERT INTO financeiro (
        clinica_id,
        paciente_id,
        agendamento_id,
        tipo,
        valor,
        data_vencimento,
        status_pagamento,
        descricao
      ) VALUES (?, ?, ?, 'receita', ?, ?, 'aberto', ?)`,
      [
        clinica_id,
        pacienteId,
        agendamentoId,
        valorSinalDinamico, // Valor capturado dinamicamente do banco
        data,
        `Sinal de Agendamento - ${nome}`
      ]
    );

    // SE CHEGOU AQUI, TUDO DEU CERTO! EFETIVA NO BANCO.
    await connection.commit();

    // --- NOTIFICAÇÕES (Fora da transação para não travar o banco se o e-mail falhar) ---
    // --- NOTIFICAÇÕES (Fora da transação) ---
    const [clinicaResult] = await db.execute('SELECT * FROM clinicas WHERE id = ?', [clinica_id]);
    const dadosDaClinica = clinicaResult[0];

    if (email && dadosDaClinica) {
      // MAPEAMENTO EXATO PARA O SEU notificationService
      const dadosParaEmail = {
        nome: nome, // O service usa agendamento.nome para nome_paciente
        email: email,
        tipo_terapia: tipo_terapia || 'Terapia Integrativa',
        data_agendamento: dataAgendamentoCompleta, // O service vai extrair data e hora daqui
        motivo_consulta: motivo_consulta || 'Consulta inicial'
      };

      notificationService.sendEmailNotification(dadosDaClinica, dadosParaEmail)
        .then(() => console.log(`[MED-LM] E-mail enviado com sucesso!`))
        .catch(err => console.error("[MED-LM] Erro ao enviar e-mail:", err));
    }
    return res.json({
      success: true,
      message: "Agendamento realizado com sucesso!"
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("ERRO CRÍTICO NO AGENDAMENTO:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Falha ao processar agendamento. Verifique os dados."
      });
    }
  } finally {
    if (connection) connection.release();
  }
};


