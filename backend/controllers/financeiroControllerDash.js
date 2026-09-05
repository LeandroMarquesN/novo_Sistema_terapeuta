const db = require('../config/db');
const notificationService = require('../services/notificationService');

// =============================================================================
// 1. GET DASHBOARD AVANÇADO (LTV, Conversão, CAC, Lucro Acumulado)
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

// =============================================================================
// 3. FLUXO DE CAIXA (visualização na tela)
// Query: ?mes=3&ano=2026  (padrão = mês/ano atuais)
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

    // Receitas pagas no período (por data_pagamento)
    const [receitas] = await db.execute(
      `SELECT
          DATE(data_pagamento) AS dia,
          SUM(valor) AS total,
          COUNT(*) AS qtd
       FROM financeiro
       WHERE clinica_id = ?
         AND status_pagamento = 'pago'
         AND data_pagamento IS NOT NULL
         AND YEAR(data_pagamento) = ?
         AND MONTH(data_pagamento) = ?
       GROUP BY DATE(data_pagamento)
       ORDER BY dia ASC`,
      [clinica_id, ano, mes]
    );

    // Despesas pagas no período (por data_vencimento — padrão atual da tabela)
    const [despesas] = await db.execute(
      `SELECT
          DATE(data_vencimento) AS dia,
          SUM(valor) AS total,
          COUNT(*) AS qtd,
          categoria
       FROM financeiro_despesas
       WHERE clinica_id = ?
         AND status_pagamento = 'pago'
         AND YEAR(data_vencimento) = ?
         AND MONTH(data_vencimento) = ?
       GROUP BY DATE(data_vencimento), categoria
       ORDER BY dia ASC`,
      [clinica_id, ano, mes]
    );

    // Detalhe dia a dia (para tabela)
    const mapa = {};
    const addDia = (diaRaw, tipo, valor, extra = {}) => {
      const key = diaRaw instanceof Date
        ? diaRaw.toISOString().slice(0, 10)
        : String(diaRaw).slice(0, 10);
      if (!mapa[key]) {
        mapa[key] = { dia: key, entradas: 0, saidas: 0, saldo_dia: 0 };
      }
      if (tipo === 'entrada') mapa[key].entradas += parseFloat(valor) || 0;
      if (tipo === 'saida') mapa[key].saidas += parseFloat(valor) || 0;
      mapa[key].saldo_dia = mapa[key].entradas - mapa[key].saidas;
      Object.assign(mapa[key], extra);
    };

    receitas.forEach((r) => addDia(r.dia, 'entrada', r.total));
    despesas.forEach((d) => addDia(d.dia, 'saida', d.total));

    const dias = Object.keys(mapa).sort();
    let acumulado = 0;
    const fluxo = dias.map((d) => {
      acumulado += mapa[d].saldo_dia;
      return { ...mapa[d], saldo_acumulado: acumulado };
    });

    const totalEntradas = fluxo.reduce((s, x) => s + x.entradas, 0);
    const totalSaidas = fluxo.reduce((s, x) => s + x.saidas, 0);

    // Despesas por categoria (pizza / breakdown)
    const porCategoria = {};
    despesas.forEach((d) => {
      const cat = d.categoria || 'outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + parseFloat(d.total || 0);
    });

    res.json({
      success: true,
      periodo: { mes, ano },
      resumo: {
        total_entradas: totalEntradas,
        total_saidas: totalSaidas,
        saldo_periodo: totalEntradas - totalSaidas,
        margem: totalEntradas > 0 ? ((totalEntradas - totalSaidas) / totalEntradas) * 100 : 0
      },
      fluxo,
      despesas_por_categoria: porCategoria,
      // séries prontas para Chart.js
      labels: fluxo.map((f) => {
        const [y, m, d] = f.dia.split('-');
        return `${d}/${m}`;
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
// 4. ENVIAR RELATÓRIO DE FLUXO DE CAIXA POR E-MAIL (e-mail da clínica)
// Body opcional: { mes, ano }  — senão usa mês atual
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

    // Reutiliza a mesma lógica do getFluxoCaixa (chamada interna via query)
    const [receitas] = await db.execute(
      `SELECT DATE(data_pagamento) AS dia, SUM(valor) AS total
       FROM financeiro
       WHERE clinica_id = ? AND status_pagamento = 'pago' AND data_pagamento IS NOT NULL
         AND YEAR(data_pagamento) = ? AND MONTH(data_pagamento) = ?
       GROUP BY DATE(data_pagamento) ORDER BY dia`,
      [clinica_id, ano, mes]
    );
    const [despesas] = await db.execute(
      `SELECT DATE(data_vencimento) AS dia, SUM(valor) AS total, categoria
       FROM financeiro_despesas
       WHERE clinica_id = ? AND status_pagamento = 'pago'
         AND YEAR(data_vencimento) = ? AND MONTH(data_vencimento) = ?
       GROUP BY DATE(data_vencimento), categoria ORDER BY dia`,
      [clinica_id, ano, mes]
    );

    const mapa = {};
    const keyDia = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
    receitas.forEach((r) => {
      const k = keyDia(r.dia);
      if (!mapa[k]) mapa[k] = { entradas: 0, saidas: 0 };
      mapa[k].entradas += parseFloat(r.total) || 0;
    });
    despesas.forEach((d) => {
      const k = keyDia(d.dia);
      if (!mapa[k]) mapa[k] = { entradas: 0, saidas: 0 };
      mapa[k].saidas += parseFloat(d.total) || 0;
    });

    const dias = Object.keys(mapa).sort();
    let totalE = 0;
    let totalS = 0;
    let linhasHTML = '';
    dias.forEach((dia) => {
      const e = mapa[dia].entradas;
      const s = mapa[dia].saidas;
      totalE += e;
      totalS += s;
      const [y, m, d] = dia.split('-');
      linhasHTML += `
        <tr style="border-bottom:1px solid #eaf2f8;">
          <td style="padding:8px;font-size:13px;">${d}/${m}/${y}</td>
          <td style="padding:8px;font-size:13px;color:#10b981;text-align:right;">R$ ${e.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td style="padding:8px;font-size:13px;color:#ef4444;text-align:right;">R$ ${s.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td style="padding:8px;font-size:13px;font-weight:700;text-align:right;">R$ ${(e - s).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    });

    if (!linhasHTML) {
      linhasHTML = `<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;">Sem movimentos neste período.</td></tr>`;
    }

    const nomesMes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const periodoLabel = `${nomesMes[mes]}/${ano}`;
    const saldo = totalE - totalS;
    const dataEmissao = new Date().toLocaleString('pt-BR');

    const htmlEmail = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b;">
        <div style="background:linear-gradient(135deg,#0891b2,#059669);padding:24px;border-radius:12px 12px 0 0;color:#fff;">
          <h1 style="margin:0;font-size:20px;">Fluxo de Caixa — ${periodoLabel}</h1>
          <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">${clinica.nome_clinica}</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
          <p style="font-size:13px;color:#64748b;">Emitido em ${dataEmissao}</p>
          <table width="100%" style="margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:12px;background:#ecfdf5;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#059669;font-weight:700;">ENTRADAS</div>
                <div style="font-size:18px;font-weight:800;color:#059669;">R$ ${totalE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </td>
              <td width="8"></td>
              <td style="padding:12px;background:#fef2f2;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#dc2626;font-weight:700;">SAÍDAS</div>
                <div style="font-size:18px;font-weight:800;color:#dc2626;">R$ ${totalS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </td>
              <td width="8"></td>
              <td style="padding:12px;background:#eff6ff;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#2563eb;font-weight:700;">SALDO</div>
                <div style="font-size:18px;font-weight:800;color:${saldo >= 0 ? '#059669' : '#dc2626'};">R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </td>
            </tr>
          </table>
          <table width="100%" style="border-collapse:collapse;margin-top:12px;">
            <thead>
              <tr style="border-bottom:2px solid #e2e8f0;text-align:left;">
                <th style="padding:8px;font-size:11px;color:#64748b;">DIA</th>
                <th style="padding:8px;font-size:11px;color:#64748b;text-align:right;">ENTRADAS</th>
                <th style="padding:8px;font-size:11px;color:#64748b;text-align:right;">SAÍDAS</th>
                <th style="padding:8px;font-size:11px;color:#64748b;text-align:right;">SALDO</th>
              </tr>
            </thead>
            <tbody>${linhasHTML}</tbody>
          </table>
          <p style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center;">
            MedLM — Relatório automático de fluxo de caixa
          </p>
        </div>
      </div>`;

    // Usa o notificationService se tiver método genérico; senão tenta o de recibo adaptado
    if (typeof notificationService.sendHtmlEmail === 'function') {
      await notificationService.sendHtmlEmail({
        to: clinica.email_master,
        subject: `Fluxo de Caixa ${periodoLabel} — ${clinica.nome_clinica}`,
        html: htmlEmail
      });
    } else if (typeof notificationService.sendEmailNotification === 'function') {
      // Fallback: muitos projetos MedLM já têm send com HTML custom
      await notificationService.sendEmailNotification(
        { ...clinica, email: clinica.email_master },
        {
          nome: clinica.nome_clinica,
          email: clinica.email_master,
          assunto: `Fluxo de Caixa ${periodoLabel}`,
          html: htmlEmail,
          tipo: 'fluxo_caixa'
        }
      );
    } else {
      console.warn('notificationService sem método de e-mail HTML — implemente sendHtmlEmail');
      return res.status(501).json({
        success: false,
        error: 'Serviço de e-mail ainda não expõe envio HTML. Adicione sendHtmlEmail no notificationService.',
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