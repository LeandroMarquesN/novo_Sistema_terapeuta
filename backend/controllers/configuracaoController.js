const db = require('../config/db'); // Sua conexão com o banco

exports.getConfiguracoes = async (req, res) => {
  // DEBUG: Veja se o ID da clínica está vindo da sessão
  console.log("Sessão da Clínica:", req.session);
  console.log("Usuário (Auth):", req.user);
  // 1. Pegar do lugar certo (req.user que vem do seu token JWT)
  const clinicaId = req.usuario?.clinica_id;

  if (!clinicaId) {
    console.error("ERRO: clinica_id não identificado no token.");
    return res.status(401).json({ success: false, message: "Usuário não autenticado." });
  }


  try {
    const [rows] = await db.execute(
      'SELECT horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal, dias_semana FROM clinica_configuracoes WHERE clinica_id = ?',
      [clinicaId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ message: "Nenhuma configuração encontrada. Use os padrões.", useDefault: true });
    }

    console.log("Dados recebidos:", req.body); // DEBUG


    res.json(rows[0]);
  } catch (error) {
    // ESSE LOG AQUI VAI TE DIZER O ERRO REAL NO TERMINAL
    console.error("ERRO CRÍTICO NO BANCO:", error.message);
    res.status(500).json({ success: false, message: "Erro ao salvar no banco", details: error.message });
  }
};

exports.updateConfiguracoes = async (req, res) => {
  // 1. Tentar pegar o clinica_id de onde quer que ele esteja
  const clinicaId = req.usuario?.clinica_id || req.body?.clinica_id;

  console.log("DEBUG CONTROLLER - ClinicaID encontrado:", clinicaId);

  if (!clinicaId) {
    return res.status(401).json({
      success: false,
      message: "Sessão inválida. clinica_id não identificado."
    });
  }

  // 2. Garantir que NENHUM valor seja undefined (usar null ou valor padrão)
  const {
    horario_abertura = null,
    horario_fechamento = null,
    duracao_atendimento = 30,
    valor_sinal = 0,
    dias_semana = '1,2,3,4,5'
  } = req.body;

  try {
    const query = `
          INSERT INTO clinica_configuracoes
              (clinica_id, horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal, dias_semana)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
              horario_abertura = VALUES(horario_abertura),
              horario_fechamento = VALUES(horario_fechamento),
              duracao_atendimento = VALUES(duracao_atendimento),
              valor_sinal = VALUES(valor_sinal),
              dias_semana = VALUES(dias_semana)
      `;

    // Execução com valores sanitizados
    await db.execute(query, [
      clinicaId,
      horario_abertura || null,
      horario_fechamento || null,
      duracao_atendimento || 30,
      valor_sinal || 0,
      dias_semana || '1,2,3,4,5'
    ]);

    res.json({ success: true, message: "Configurações salvas!" });
  } catch (error) {
    console.error("ERRO NO BANCO:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};