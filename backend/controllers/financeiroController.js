// controllers/financeiroController.js
const db = require('../config/db');

const financeiroController = {
  // Listar todos os lançamentos da clínica logada
  listar: async (req, res) => {
    try {
      const { clinica_id } = req.usuario;
      const { status, busca } = req.query;

      let query = `
                SELECT f.*, p.nome AS paciente_nome, p.telefone AS paciente_tel
                FROM financeiro f
                JOIN pacientes p ON f.paciente_id = p.id
                WHERE f.clinica_id = ?
            `;
      const params = [clinica_id];

      if (status && status !== 'todos') {
        query += ` AND f.status_pagamento = ?`;
        params.push(status);
      }

      if (busca) {
        query += ` AND (p.nome LIKE ? OR p.cpf LIKE ?)`;
        params.push(`%${busca}%`, `%${busca}%`);
      }

      query += ` ORDER BY f.data_vencimento ASC`;

      const [rows] = await db.execute(query, params);
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar financeiro' });
    }
  },

  // Confirmar recebimento (Dar Baixa)
  baixar: async (req, res) => {
    const connection = await db.getConnection();
    try {
      const { id } = req.params;
      const { metodo_pagamento } = req.body;
      const { clinica_id } = req.usuario;

      console.log("Processando baixa para ID:", id, "Método:", metodo_pagamento);

      await connection.beginTransaction();

      // 1. Atualiza o Financeiro para 'pago'
      const [result] = await connection.execute(
        `UPDATE financeiro SET status_pagamento = 'pago', metodo_pagamento = ?, data_pagamento = NOW()
         WHERE id = ? AND clinica_id = ?`,
        [metodo_pagamento, id, clinica_id]
      );

      if (result.affectedRows === 0) {
        throw new Error('Lançamento não encontrado ou acesso negado.');
      }

      // 2. BUSCA O AGENDAMENTO E O PACIENTE VINCULADOS
      const [lancamento] = await connection.execute(
        `SELECT agendamento_id, paciente_id FROM financeiro WHERE id = ?`, [id]
      );

      const dadosLancamento = lancamento[0];

      if (dadosLancamento) {
        // 3. Atualiza o Agendamento para 'confirmado' (se houver um vinculado)
        if (dadosLancamento.agendamento_id) {
          await connection.execute(
            `UPDATE agendamentos SET status_agendamento = 'confirmado' WHERE id = ?`,
            [dadosLancamento.agendamento_id]
          );
        }

        // 4. Atualiza o Paciente (Agora pegando o ID correto que veio do banco!)
        if (dadosLancamento.paciente_id) {
          await connection.execute(
            `UPDATE pacientes SET status_pagamento = 'pago'
             WHERE id = ? AND clinica_id = ?`,
            [dadosLancamento.paciente_id, clinica_id]
          );
        }
      }

      await connection.commit();
      res.json({ success: true, message: 'Baixa realizada com sucesso!' });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error("ERRO NA BAIXA FINANCEIRA:", error.message);
      res.status(500).json({ error: error.message });
    } finally {
      connection.release();
    }
  },

  // Dados para os "Cards de Poder"
  getResumo: async (req, res) => {
    try {
      const { clinica_id } = req.usuario;

      const query = `
                SELECT
                    COALESCE(SUM(CASE WHEN status_pagamento = 'aberto' THEN valor ELSE 0 END), 0) as saldo_receber,
                    COALESCE(SUM(CASE WHEN status_pagamento = 'pago' THEN valor ELSE 0 END), 0) as faturamento_mes,
                    COUNT(CASE WHEN status_pagamento = 'aberto' AND data_vencimento < CURDATE() THEN 1 END) as inadimplentes,
                    COALESCE(AVG(CASE WHEN status_pagamento = 'pago' THEN valor END), 0) as ticket_medio
                FROM financeiro
                WHERE clinica_id = ? AND MONTH(data_vencimento) = MONTH(CURDATE())
            `;

      const [rows] = await db.execute(query, [clinica_id]);

      if (rows && rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.json({
          saldo_receber: 0,
          faturamento_mes: 0,
          inadimplentes: 0,
          ticket_medio: 0
        });
      }
    } catch (error) {
      console.error("Erro no SQL do Resumo:", error);
      res.status(500).json({ error: 'Erro ao calcular resumo' });
    }
  }
}; // <--- ESSA CHAVE AQUI É A QUE FALTAVA!

module.exports = financeiroController;