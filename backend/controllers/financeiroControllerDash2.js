const db = require('../config/db');

// =============================================================================
// 1. GET DASHBOARD AVANÇADO (LTV, Conversão, CAC, Lucro Acumulado)
// =============================================================================
exports.getDashboardAvancado = async (req, res) => {
  try {
    const { clinica_id } = req.usuario;

    const query = `
            SELECT
                /* 1. LTV MÉDIO */
                (SELECT COALESCE(AVG(soma_paga), 0) FROM (
                    SELECT SUM(valor) as soma_paga FROM financeiro
                    WHERE status_pagamento = 'pago' AND clinica_id = ? GROUP BY paciente_id
                ) as sub) as ltv_medio,

                /* 2. TAXA DE CONVERSÃO DO PORTAL (%) */
                (SELECT
                    COALESCE((COUNT(CASE WHEN f.status_pagamento = 'pago' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0)), 0)
                    FROM agendamentos a
                    INNER JOIN pacientes p ON a.paciente_id = p.id
                    LEFT JOIN financeiro f ON a.id = f.agendamento_id
                    WHERE a.clinica_id = ? AND p.origem = 'portal'
                ) as taxa_conversao,

                /* 3. CAC (Gasto Marketing / Novos Pacientes Portal) */
                (SELECT
                    COALESCE(SUM(valor), 0) / NULLIF((SELECT COUNT(*) FROM pacientes WHERE clinica_id = ? AND origem = 'portal'), 0)
                    FROM financeiro_despesas
                    WHERE clinica_id = ? AND categoria = 'marketing'
                ) as cac,

                /* 4. LUCRO REAL ACUMULADO (Total Pago - Despesas Pagas) */
                ((SELECT COALESCE(SUM(valor), 0) FROM financeiro WHERE clinica_id = ? AND status_pagamento = 'pago') -
                 (SELECT COALESCE(SUM(valor), 0) FROM financeiro_despesas WHERE clinica_id = ? AND status_pagamento = 'pago')
                ) as lucro_real

            FROM clinicas WHERE id = ?;
        `;

    const [rows] = await db.execute(query, [
      clinica_id, clinica_id, clinica_id, clinica_id, clinica_id, clinica_id, clinica_id
    ]);

    res.json(rows[0]);
  } catch (error) {
    console.error("Erro no Dashboard Avançado:", error);
    res.status(500).json({ error: 'Erro ao processar métricas' });
  }
};

// =============================================================================
// 2. GET LUCRO REAL MENSAL (Com fuso horário corrigido)
// =============================================================================
exports.getLucroReal = async (req, res) => {
  try {
    const { clinica_id } = req.usuario;

    // 🌟 CORREÇÃO DO FUSO MENSAL: Pegamos ano e mês locais estáveis do servidor de SP
    const dataLocal = new Date();
    const anoAtual = dataLocal.getFullYear();
    const mesAtual = dataLocal.getMonth() + 1; // Retorna o mês real de 1 a 12

    const query = `
          SELECT
              /* Soma tudo que foi PAGO pelos pacientes no mês/ano correntes */
              (SELECT COALESCE(SUM(valor), 0) FROM financeiro
               WHERE clinica_id = ? AND status_pagamento = 'pago'
               AND YEAR(data_pagamento) = ? AND MONTH(data_pagamento) = ?) as total_receita,

              /* Soma todas as despesas PAGAS pela clínica no mês/ano correntes */
              (SELECT COALESCE(SUM(valor), 0) FROM financeiro_despesas
               WHERE clinica_id = ? AND status_pagamento = 'pago'
               AND YEAR(data_vencimento) = ? AND MONTH(data_vencimento) = ?) as total_despesa
      `;

    // Injetamos clinica_id, ano e mês para cada uma das subqueries de forma isolada
    const [rows] = await db.execute(query, [
      clinica_id, anoAtual, mesAtual,
      clinica_id, anoAtual, mesAtual
    ]);

    const { total_receita, total_despesa } = rows[0];
    const lucro_real = total_receita - total_despesa;

    res.json({
      receita: total_receita,
      despesa: total_despesa,
      lucro: lucro_real,
      margem: total_receita > 0 ? (lucro_real / total_receita) * 100 : 0
    });
  } catch (error) {
    console.error("Erro ao calcular lucro real no Dashboard:", error);
    res.status(500).json({ error: 'Erro ao calcular lucro real' });
  }
};