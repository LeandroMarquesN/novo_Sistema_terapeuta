const db = require('../config/db');

exports.getConfiguracoes = async (req, res) => {
  const clinicaId = req.usuario?.clinica_id;

  if (!clinicaId) {
    console.error("ERRO: clinica_id não identificado no token.");
    return res.status(401).json({ success: false, message: "Usuário não autenticado." });
  }

  try {
    // ORDER BY id DESC: se existirem linhas duplicadas antigas, pega a mais recente
    const [rows] = await db.execute(
      `SELECT horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal, dias_semana, periodos_fechados
       FROM clinica_configuracoes
       WHERE clinica_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [clinicaId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ message: "Nenhuma configuração encontrada. Use os padrões.", useDefault: true });
    }

    const config = rows[0];

    // mysql2 pode devolver JSON já parseado ou string — normalizamos para string
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

  // Valida e normaliza periodos_fechados
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
    // Busca a linha mais recente desta clínica (se houver)
    const [existentes] = await db.execute(
      `SELECT id FROM clinica_configuracoes WHERE clinica_id = ? ORDER BY id DESC LIMIT 1`,
      [clinicaId]
    );

    if (existentes.length > 0) {
      const idParaAtualizar = existentes[0].id;

      await db.execute(
        `UPDATE clinica_configuracoes
         SET horario_abertura = ?,
             horario_fechamento = ?,
             duracao_atendimento = ?,
             valor_sinal = ?,
             dias_semana = ?,
             periodos_fechados = ?
         WHERE id = ?`,
        [
          horario_abertura || null,
          horario_fechamento || null,
          duracao_atendimento || 30,
          valor_sinal || 0,
          dias_semana || '1,2,3,4,5',
          periodosParaSalvar,
          idParaAtualizar
        ]
      );

      // Remove duplicatas antigas (mantém só a linha que acabamos de atualizar)
      await db.execute(
        `DELETE FROM clinica_configuracoes WHERE clinica_id = ? AND id <> ?`,
        [clinicaId, idParaAtualizar]
      );
    } else {
      await db.execute(
        `INSERT INTO clinica_configuracoes
            (clinica_id, horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal, dias_semana, periodos_fechados)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          clinicaId,
          horario_abertura || null,
          horario_fechamento || null,
          duracao_atendimento || 30,
          valor_sinal || 0,
          dias_semana || '1,2,3,4,5',
          periodosParaSalvar
        ]
      );
    }

    res.json({ success: true, message: "Configurações salvas!" });
  } catch (error) {
    console.error("ERRO NO BANCO:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
