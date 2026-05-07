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
exports.criarAgendamento = async (req, res) => {
  const {
    clinica_id, nome, email, telefone, cpf, data, horario,
    genero, data_nascimento, tipo_terapia, motivo_consulta
  } = req.body;

  const connection = await db.getConnection(); // Usamos conexão para Transação (garante que ou faz tudo ou nada)

  try {
    await connection.beginTransaction();

    // 1. Criar ou Localizar o Paciente (Baseado no CPF ou Email)
    // Para simplificar, vamos criar um novo registro na tabela pacientes primeiro
    const [resPaciente] = await connection.execute(
      `INSERT INTO pacientes (clinica_id, nome, email, telefone, cpf) VALUES (?, ?, ?, ?, ?)`,
      [clinica_id, nome, email, telefone, cpf]
    );
    const pacienteId = resPaciente.insertId;

    // 2. Buscar o ID do primeiro usuário (Admin) da clínica para preencher usuario_id
    const [usuarios] = await connection.execute(
      'SELECT id FROM usuarios WHERE clinica_id = ? LIMIT 1',
      [clinica_id]
    );
    const usuarioId = usuarios[0]?.id || 1; // Fallback para ID 1 caso não ache

    // 3. Formatar data e hora para o MySQL
    const dataAgendamentoCompleta = `${data} ${horario}:00`;

    // 4. Inserir na tabela agendamentos conforme seu SQL
    const queryAgendamento = `
            INSERT INTO agendamentos (
                clinica_id, paciente_id, usuario_id, data_agendamento,
                status_agendamento, nome, email, telefone, cpf,
                genero, data_nascimento, tipo_terapia, motivo_consulta
            ) VALUES (?, ?, ?, ?, 'aguardando_sinal', ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    await connection.execute(queryAgendamento, [
      clinica_id, pacienteId, usuarioId, dataAgendamentoCompleta,
      nome, email, telefone, cpf,
      genero || null, data_nascimento || null, tipo_terapia || null, motivo_consulta || null
    ]);

    await connection.commit();

    // ---- INÍCIO DA LÓGICA DE NOTIFICAÇÃO ----

    // 1. Buscamos os dados da clínica
    const [clinicaResult] = await connection.execute(
      'SELECT nome_clinica, telefone_clinica FROM clinicas WHERE id = ?',
      [clinica_id]
    );

    const dadosDaClinica = clinicaResult[0];

    // 2. Só dispara se tivermos o e-mail do paciente e os dados da clínica
    if (email && dadosDaClinica) {
      const dadosDoAgendamento = {
        nome: nome,
        email: email,
        tipo_terapia: tipo_terapia || 'Não informado',
        data_agendamento: dataAgendamentoCompleta,
        motivo_consulta: motivo_consulta || 'Nenhum'
      };

      // Chamada única e eficiente
      notificationService.sendEmailNotification(dadosDaClinica, dadosDoAgendamento)
        .then(() => console.log(`[MED-LM] E-mail de confirmação enviado para: ${email}`))
        .catch(err => console.error("[MED-LM] Erro no envio de e-mail:", err));
    }

    // 3. Resposta final para o frontend abrir o modal de sucesso
    return res.json({
      success: true,
      message: "Agendamento realizado! Aguardando sinal."
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Erro na transação de agendamento:", error);

    // Garante que não enviamos resposta se os headers já foram enviados
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Falha ao gravar agendamento." });
    }
  } finally {
    if (connection) connection.release();
  }
};


