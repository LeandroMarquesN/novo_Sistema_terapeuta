const db = require('../config/db');

exports.salvar = async (req, res) => {
  try {
    // O clinica_id vem do token (Middleware de autenticação)
    const { clinica_id } = req.usuario;
    const { descricao, valor, categoria, data_vencimento } = req.body;

    const query = `
          INSERT INTO financeiro_despesas
          (clinica_id, descricao, valor, categoria, data_vencimento, status_pagamento)
          VALUES (?, ?, ?, ?, ?, 'pago')
      `;

    await db.execute(query, [
      clinica_id,
      descricao,
      valor,
      categoria,
      data_vencimento
    ]);

    return res.json({ success: true, message: "Despesa registrada com sucesso!" });

  } catch (error) {
    console.error("Erro ao salvar despesa no banco:", error);
    return res.status(500).json({ error: "Erro interno ao salvar despesa" });
  }
};

