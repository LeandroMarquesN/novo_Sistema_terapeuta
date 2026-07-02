
//
//   // 1. Pegar do lugar certo (req.user que vem do seu token JWT)
//   const clinicaId = req.usuario?.clinica_id;

const db = require('../config/db');

exports.getConfiguracoes = async (req, res) => {

  console.log("Sessão da Clínica:", req.session);
  console.log("Usuário (Auth):", req.user);

  const clinicaId = req.usuario?.clinica_id;

  if (!clinicaId) {
    console.error("ERRO: clinica_id não identificado no token.");
    return res.status(401).json({ success: false, message: "Usuário não autenticado." });
  }

  try {
    const [rows] = await db.execute(
      'SELECT horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal, dias_semana, periodos_fechados FROM clinica_configuracoes WHERE clinica_id = ?',
      [clinicaId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ message: "Nenhuma configuração encontrada. Use os padrões.", useDefault: true });
    }

    const config = rows[0];

    // Se a coluna for JSON, o mysql2 já devolve objeto/array. Se for TEXT, vem string.
    // O front trata os dois casos, mas normalizamos aqui pra sempre mandar string.
    if (config.periodos_fechados && typeof config.periodos_fechados !== 'string') {
      config.periodos_fechados = JSON.stringify(config.periodos_fechados);
    }

    res.json(config);
  } catch (error) {
    console.error("ERRO CRÍTICO NO BANCO:", error.message);
    res.status(500).json({ success: false, message: "Erro ao carregar configurações", details: error.message });
  }
};

exports.updateConfiguracoes = async (req, res) => {
  const clinicaId = req.usuario?.clinica_id || req.body?.clinica_id;

  if (!clinicaId) {
    return res.status(401).json({
      success: false,
      message: "Sessão inválida. clinica_id não identificado."
    });
  }

  const {
    horario_abertura = null,
    horario_fechamento = null,
    duracao_atendimento = 30,
    valor_sinal = 0,
    dias_semana = '1,2,3,4,5',
    periodos_fechados = '[]'
  } = req.body;

  // Valida que periodos_fechados é um JSON válido antes de gravar
  let periodosParaSalvar = '[]';
  try {
    const parsed = typeof periodos_fechados === 'string'
      ? JSON.parse(periodos_fechados)
      : periodos_fechados;
    periodosParaSalvar = JSON.stringify(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    console.warn("periodos_fechados inválido, salvando array vazio:", e.message);
  }

  try {
    const query = `
          INSERT INTO clinica_configuracoes
              (clinica_id, horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal, dias_semana, periodos_fechados)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
              horario_abertura = VALUES(horario_abertura),
              horario_fechamento = VALUES(horario_fechamento),
              duracao_atendimento = VALUES(duracao_atendimento),
              valor_sinal = VALUES(valor_sinal),
              dias_semana = VALUES(dias_semana),
              periodos_fechados = VALUES(periodos_fechados)
      `;

    await db.execute(query, [
      clinicaId,
      horario_abertura || null,
      horario_fechamento || null,
      duracao_atendimento || 30,
      valor_sinal || 0,
      dias_semana || '1,2,3,4,5',
      periodosParaSalvar
    ]);

    res.json({ success: true, message: "Configurações salvas!" });
  } catch (error) {
    console.error("ERRO NO BANCO:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

