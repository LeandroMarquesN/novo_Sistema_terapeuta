const db = require('../config/db');
const notificationService = require('../services/notificationService');

// =============================================================================
// 1. GET DASHBOARD AVANÇADO
// =============================================================================
exports.getDashboardAvancado = async (req, res) => {
  try {
    const { clinica_id } = req.usuario;

    const query = `
            SELECT
                (SELECT COALESCE(AVG(soma_paga), 0) FROM (
                    SELECT SUM(valor) as soma_paga FROM financeiro
                    WHERE status_pagamento = 'pago' AND clinica_id = ? GROUP BY paciente_id
                ) as sub) as ltv_medio,

                (SELECT
                    COALESCE((COUNT(CASE WHEN f.status_pagamento = 'pago' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0)), 0)
                    FROM agendamentos a
                    INNER JOIN pacientes p ON a.paciente_id = p.id
                    LEFT JOIN financeiro f ON a.id = f.agendamento_id
                    WHERE a.clinica_id = ? AND p.origem = 'portal'
                ) as taxa_conversao,

                (SELECT
                    COALESCE(SUM(valor), 0) / NULLIF((SELECT COUNT(*) FROM pacientes WHERE clinica_id = ? AND origem = 'portal'), 0)
                    FROM financeiro_despesas
                    WHERE clinica_id = ? AND categoria = 'marketing'
                ) as cac,

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
// 2. GET LUCRO REAL MENSAL
// =============================================================================
exports.getLucroReal = async (req, res) => {
  try {
    const { clinica_id } = req.usuario;
    const dataLocal = new Date();
    const anoAtual = dataLocal.getFullYear();
    const mesAtual = dataLocal.getMonth() + 1;

    const query = `
          SELECT
              (SELECT COALESCE(SUM(valor), 0) FROM financeiro
               WHERE clinica_id = ? AND status_pagamento = 'pago'
               AND YEAR(data_pagamento) = ? AND MONTH(data_pagamento) = ?) as total_receita,
              (SELECT COALESCE(SUM(valor), 0) FROM financeiro_despesas
               WHERE clinica_id = ? AND status_pagamento = 'pago'
               AND YEAR(data_vencimento) = ? AND MONTH(data_vencimento) = ?) as total_despesa
      `;

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

function keyDia(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function fmtBR(n) {
  return parseFloat(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// =============================================================================
// 3. FLUXO DE CAIXA — detalhado (descrição de cada entrada/saída)
// =============================================================================
exports.getFluxoCaixa = async (req, res) => {
  try {
    const { clinica_id } = req.usuario;
    const agora = new Date();
    const mes = parseInt(req.query.mes, 10) || (agora.getMonth() + 1);
    const ano = parseInt(req.query.ano, 10) || agora.getFullYear();

    if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
      return res.status(400).json({ error: 'Mês ou ano inválido.' });
    }

    // Entradas detalhadas (receitas pagas)
    const [entradasRows] = await db.execute(
      `SELECT
          f.id,
          DATE(f.data_pagamento) AS dia,
          f.valor,
          f.descricao,
          f.categoria,
          f.metodo_pagamento,
          p.nome AS paciente_nome
       FROM financeiro f
       LEFT JOIN pacientes p ON p.id = f.paciente_id
       WHERE f.clinica_id = ?
         AND f.status_pagamento = 'pago'
         AND f.data_pagamento IS NOT NULL
         AND YEAR(f.data_pagamento) = ?
         AND MONTH(f.data_pagamento) = ?
       ORDER BY f.data_pagamento ASC, f.id ASC`,
      [clinica_id, ano, mes]
    );

    // Saídas detalhadas (despesas pagas)
    const [saidasRows] = await db.execute(
      `SELECT
          id,
          DATE(data_vencimento) AS dia,
          valor,
          descricao,
          categoria
       FROM financeiro_despesas
       WHERE clinica_id = ?
         AND status_pagamento = 'pago'
         AND YEAR(data_vencimento) = ?
         AND MONTH(data_vencimento) = ?
       ORDER BY data_vencimento ASC, id ASC`,
      [clinica_id, ano, mes]
    );

    // Lista unificada de movimentos (para tabela)
    const movimentos = [];

    entradasRows.forEach((r) => {
      const dia = keyDia(r.dia);
      const descBase = r.descricao || r.categoria || 'Receita';
      const paciente = r.paciente_nome ? ` — ${r.paciente_nome}` : '';
      movimentos.push({
        id: `e-${r.id}`,
        dia,
        tipo: 'entrada',
        descricao: `${descBase}${paciente}`,
        categoria: r.categoria || 'Consulta',
        metodo: r.metodo_pagamento || null,
        valor: parseFloat(r.valor) || 0
      });
    });

    saidasRows.forEach((r) => {
      const dia = keyDia(r.dia);
      movimentos.push({
        id: `s-${r.id}`,
        dia,
        tipo: 'saida',
        descricao: r.descricao || r.categoria || 'Despesa',
        categoria: r.categoria || 'outros',
        metodo: null,
        valor: parseFloat(r.valor) || 0
      });
    });

    movimentos.sort((a, b) => {
      if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
      if (a.tipo !== b.tipo) return a.tipo === 'entrada' ? -1 : 1;
      return 0;
    });

    // Agregado por dia (gráfico)
    const mapa = {};
    movimentos.forEach((m) => {
      if (!mapa[m.dia]) mapa[m.dia] = { dia: m.dia, entradas: 0, saidas: 0, saldo_dia: 0 };
      if (m.tipo === 'entrada') mapa[m.dia].entradas += m.valor;
      else mapa[m.dia].saidas += m.valor;
      mapa[m.dia].saldo_dia = mapa[m.dia].entradas - mapa[m.dia].saidas;
    });

    const dias = Object.keys(mapa).sort();
    let acumulado = 0;
    const fluxo = dias.map((d) => {
      acumulado += mapa[d].saldo_dia;
      return { ...mapa[d], saldo_acumulado: acumulado };
    });

    const totalEntradas = movimentos.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0);
    const totalSaidas = movimentos.filter((m) => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0);

    const porCategoria = {};
    saidasRows.forEach((d) => {
      const cat = d.categoria || 'outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + (parseFloat(d.valor) || 0);
    });

    res.json({
      success: true,
      periodo: { mes, ano },
      resumo: {
        total_entradas: totalEntradas,
        total_saidas: totalSaidas,
        saldo_periodo: totalEntradas - totalSaidas,
        margem: totalEntradas > 0 ? ((totalEntradas - totalSaidas) / totalEntradas) * 100 : 0,
        qtd_entradas: entradasRows.length,
        qtd_saidas: saidasRows.length
      },
      movimentos,
      fluxo,
      despesas_por_categoria: porCategoria,
      labels: fluxo.map((f) => {
        const parts = f.dia.split('-');
        return `${parts[2]}/${parts[1]}`;
      }),
      serie_entradas: fluxo.map((f) => f.entradas),
      serie_saidas: fluxo.map((f) => f.saidas),
      serie_acumulado: fluxo.map((f) => f.saldo_acumulado)
    });
  } catch (error) {
    console.error('Erro no fluxo de caixa:', error);
    res.status(500).json({ error: 'Erro ao gerar fluxo de caixa' });
  }
};

// =============================================================================
// 4. E-MAIL FLUXO DE CAIXA — template completo com descrições
// =============================================================================
exports.enviarFluxoCaixaEmail = async (req, res) => {
  try {
    const { clinica_id } = req.usuario;
    const agora = new Date();
    const mes = parseInt(req.body.mes || req.query.mes, 10) || (agora.getMonth() + 1);
    const ano = parseInt(req.body.ano || req.query.ano, 10) || agora.getFullYear();

    const [clinicaRows] = await db.execute(
      `SELECT nome_clinica, email_master, telefone_clinica FROM clinicas WHERE id = ?`,
      [clinica_id]
    );
    if (!clinicaRows.length) {
      return res.status(404).json({ success: false, error: 'Clínica não encontrada.' });
    }
    const clinica = clinicaRows[0];
    if (!clinica.email_master) {
      return res.status(400).json({
        success: false,
        error: 'A clínica não possui e-mail master cadastrado.'
      });
    }

    const [entradasRows] = await db.execute(
      `SELECT DATE(f.data_pagamento) AS dia, f.valor, f.descricao, f.categoria, p.nome AS paciente_nome
       FROM financeiro f
       LEFT JOIN pacientes p ON p.id = f.paciente_id
       WHERE f.clinica_id = ? AND f.status_pagamento = 'pago' AND f.data_pagamento IS NOT NULL
         AND YEAR(f.data_pagamento) = ? AND MONTH(f.data_pagamento) = ?
       ORDER BY f.data_pagamento ASC`,
      [clinica_id, ano, mes]
    );

    const [saidasRows] = await db.execute(
      `SELECT DATE(data_vencimento) AS dia, valor, descricao, categoria
       FROM financeiro_despesas
       WHERE clinica_id = ? AND status_pagamento = 'pago'
         AND YEAR(data_vencimento) = ? AND MONTH(data_vencimento) = ?
       ORDER BY data_vencimento ASC`,
      [clinica_id, ano, mes]
    );

    let totalE = 0;
    let totalS = 0;
    let linhasEntrada = '';
    let linhasSaida = '';

    entradasRows.forEach((r) => {
      const v = parseFloat(r.valor) || 0;
      totalE += v;
      const dia = keyDia(r.dia);
      const [y, m, d] = dia.split('-');
      const desc = (r.descricao || r.categoria || 'Receita') + (r.paciente_nome ? ` — ${r.paciente_nome}` : '');
      linhasEntrada += `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e8eef5;font-size:13px;color:#475569;">${d}/${m}/${y}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e8eef5;font-size:13px;color:#1e293b;">${desc}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e8eef5;font-size:13px;color:#059669;font-weight:700;text-align:right;">R$ ${fmtBR(v)}</td>
        </tr>`;
    });

    saidasRows.forEach((r) => {
      const v = parseFloat(r.valor) || 0;
      totalS += v;
      const dia = keyDia(r.dia);
      const [y, m, d] = dia.split('-');
      const desc = r.descricao || r.categoria || 'Despesa';
      const cat = r.categoria ? ` <span style="color:#94a3b8;font-size:11px;">(${r.categoria})</span>` : '';
      linhasSaida += `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e8eef5;font-size:13px;color:#475569;">${d}/${m}/${y}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e8eef5;font-size:13px;color:#1e293b;">${desc}${cat}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e8eef5;font-size:13px;color:#dc2626;font-weight:700;text-align:right;">R$ ${fmtBR(v)}</td>
        </tr>`;
    });

    if (!linhasEntrada) {
      linhasEntrada = `<tr><td colspan="3" style="padding:16px;text-align:center;color:#94a3b8;">Nenhuma entrada no período.</td></tr>`;
    }
    if (!linhasSaida) {
      linhasSaida = `<tr><td colspan="3" style="padding:16px;text-align:center;color:#94a3b8;">Nenhuma saída no período.</td></tr>`;
    }

    const nomesMes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const periodoLabel = `${nomesMes[mes]}/${ano}`;
    const saldo = totalE - totalS;
    const dataEmissao = new Date().toLocaleString('pt-BR');

    const htmlEmail = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0891b2 0%,#059669 100%);padding:28px 32px;color:#fff;">
            <div style="font-size:12px;opacity:0.85;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">MedLM · Relatório financeiro</div>
            <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Fluxo de Caixa</h1>
            <p style="margin:0;font-size:15px;opacity:0.95;">${periodoLabel} · ${clinica.nome_clinica}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 16px;font-size:12px;color:#64748b;">Emitido em ${dataEmissao}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td width="32%" style="background:#ecfdf5;border-radius:12px;padding:14px;text-align:center;">
                  <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;">Entradas</div>
                  <div style="font-size:18px;font-weight:800;color:#059669;margin-top:4px;">R$ ${fmtBR(totalE)}</div>
                </td>
                <td width="2%"></td>
                <td width="32%" style="background:#fef2f2;border-radius:12px;padding:14px;text-align:center;">
                  <div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;">Saídas</div>
                  <div style="font-size:18px;font-weight:800;color:#dc2626;margin-top:4px;">R$ ${fmtBR(totalS)}</div>
                </td>
                <td width="2%"></td>
                <td width="32%" style="background:#eff6ff;border-radius:12px;padding:14px;text-align:center;">
                  <div style="font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;">Saldo</div>
                  <div style="font-size:18px;font-weight:800;color:${saldo >= 0 ? '#059669' : '#dc2626'};margin-top:4px;">R$ ${fmtBR(saldo)}</div>
                </td>
              </tr>
            </table>

            <h2 style="margin:0 0 10px;font-size:14px;color:#059669;text-transform:uppercase;letter-spacing:0.06em;">Entradas (receitas)</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Data</th>
                  <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Descrição</th>
                  <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;">Valor</th>
                </tr>
              </thead>
              <tbody>${linhasEntrada}</tbody>
            </table>

            <h2 style="margin:0 0 10px;font-size:14px;color:#dc2626;text-transform:uppercase;letter-spacing:0.06em;">Saídas (despesas)</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Data</th>
                  <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Descrição</th>
                  <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;">Valor</th>
                </tr>
              </thead>
              <tbody>${linhasSaida}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
            © ${new Date().getFullYear()} MedLM — ${clinica.nome_clinica}
            ${clinica.telefone_clinica ? ` · ${clinica.telefone_clinica}` : ''}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const assunto = `Fluxo de Caixa ${periodoLabel} — ${clinica.nome_clinica}`;

    if (typeof notificationService.sendHtmlEmail === 'function') {
      await notificationService.sendHtmlEmail({
        to: clinica.email_master,
        subject: assunto,
        html: htmlEmail
      });
    } else if (typeof notificationService.sendReciboEmailNotification === 'function') {
      // Reaproveita canal de e-mail do recibo, se existir overload genérico
      await notificationService.sendReciboEmailNotification(
        { ...clinica, email: clinica.email_master },
        {
          pacienteNome: clinica.nome_clinica,
          pacienteEmail: clinica.email_master,
          operadorNome: 'Sistema MedLM',
          dataEmissao,
          linhasHTML: linhasEntrada + linhasSaida,
          valorPago: `R$ ${fmtBR(totalE)}`,
          valorAberto: `R$ ${fmtBR(totalS)}`,
          assunto,
          htmlCustom: htmlEmail,
          tipo: 'fluxo_caixa'
        }
      );
    } else if (typeof notificationService.sendEmailNotification === 'function') {
      await notificationService.sendEmailNotification(
        { ...clinica, email: clinica.email_master },
        {
          nome: clinica.nome_clinica,
          email: clinica.email_master,
          assunto,
          html: htmlEmail,
          tipo: 'fluxo_caixa'
        }
      );
    } else {
      return res.status(501).json({
        success: false,
        error: 'Serviço de e-mail sem método HTML. Implemente sendHtmlEmail.',
        preview_html: htmlEmail
      });
    }

    res.json({
      success: true,
      message: `Relatório enviado para ${clinica.email_master}`,
      periodo: { mes, ano }
    });
  } catch (error) {
    console.error('Erro ao enviar fluxo de caixa:', error);
    res.status(500).json({ success: false, error: 'Erro ao enviar relatório por e-mail.' });
  }
};
