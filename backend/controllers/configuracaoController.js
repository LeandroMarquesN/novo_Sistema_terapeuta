const db = require('../config/db');

function normalizarJsonArray(valor, nomeCampo) {
  try {
    const parsed = typeof valor === 'string' ? JSON.parse(valor || '[]') : valor;
    return JSON.stringify(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    console.warn(`${nomeCampo} inválido, salvando array vazio:`, e.message);
    return '[]';
  }
}

function garantirStringJson(campo) {
  if (campo && typeof campo !== 'string') {
    return JSON.stringify(campo);
  }
  return campo;
}

exports.getConfiguracoes = async (req, res) => {
  const clinicaId = req.usuario?.clinica_id;

  if (!clinicaId) {
    console.error("ERRO: clinica_id não identificado no token.");
    return res.status(401).json({ success: false, message: "Usuário não autenticado." });
  }

  try {
    let rows;
    try {
      [rows] = await db.execute(
        `SELECT horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal,
                dias_semana, periodos_fechados, intervalos_pausa
         FROM clinica_configuracoes
         WHERE clinica_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [clinicaId]
      );
    } catch (colErr) {
      [rows] = await db.execute(
        `SELECT horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal,
                dias_semana, periodos_fechados
         FROM clinica_configuracoes
         WHERE clinica_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [clinicaId]
      );
    }

    if (rows.length === 0) {
      return res.status(200).json({ message: "Nenhuma configuração encontrada. Use os padrões.", useDefault: true });
    }

    const config = rows[0];
    config.periodos_fechados = garantirStringJson(config.periodos_fechados) || '[]';
    config.intervalos_pausa = garantirStringJson(config.intervalos_pausa) || '[]';

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
    periodos_fechados = '[]',
    intervalos_pausa = '[]'
  } = req.body;

  const periodosParaSalvar = normalizarJsonArray(periodos_fechados, 'periodos_fechados');
  const pausasParaSalvar = normalizarJsonArray(intervalos_pausa, 'intervalos_pausa');

  try {
    const pausas = JSON.parse(pausasParaSalvar);
    for (const p of pausas) {
      if (!p.inicio || !p.fim) {
        return res.status(400).json({ success: false, message: 'Cada intervalo de pausa precisa de início e fim.' });
      }
      if (String(p.fim) <= String(p.inicio)) {
        return res.status(400).json({
          success: false,
          message: `O fim da pausa "${p.titulo || ''}" deve ser depois do início.`
        });
      }
    }
  } catch (_) { /* já normalizado */ }

  try {
    const [existentes] = await db.execute(
      `SELECT id FROM clinica_configuracoes WHERE clinica_id = ? ORDER BY id DESC LIMIT 1`,
      [clinicaId]
    );

    if (existentes.length > 0) {
      const idParaAtualizar = existentes[0].id;

      try {
        await db.execute(
          `UPDATE clinica_configuracoes
           SET horario_abertura = ?,
               horario_fechamento = ?,
               duracao_atendimento = ?,
               valor_sinal = ?,
               dias_semana = ?,
               periodos_fechados = ?,
               intervalos_pausa = ?
           WHERE id = ?`,
          [
            horario_abertura || null,
            horario_fechamento || null,
            duracao_atendimento || 30,
            valor_sinal || 0,
            dias_semana || '1,2,3,4,5',
            periodosParaSalvar,
            pausasParaSalvar,
            idParaAtualizar
          ]
        );
      } catch (colErr) {
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
      }

      await db.execute(
        `DELETE FROM clinica_configuracoes WHERE clinica_id = ? AND id <> ?`,
        [clinicaId, idParaAtualizar]
      );
    } else {
      try {
        await db.execute(
          `INSERT INTO clinica_configuracoes
              (clinica_id, horario_abertura, horario_fechamento, duracao_atendimento, valor_sinal, dias_semana, periodos_fechados, intervalos_pausa)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            clinicaId,
            horario_abertura || null,
            horario_fechamento || null,
            duracao_atendimento || 30,
            valor_sinal || 0,
            dias_semana || '1,2,3,4,5',
            periodosParaSalvar,
            pausasParaSalvar
          ]
        );
      } catch (colErr) {
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
    }

    res.json({ success: true, message: "Configurações salvas!" });
  } catch (error) {
    console.error("ERRO NO BANCO:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
