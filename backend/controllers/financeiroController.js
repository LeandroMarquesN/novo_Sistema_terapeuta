

// controllers/financeiroController.js
const db = require('../config/db');
const notificationService = require('../services/notificationService');

const financeiroController = {
  // Listar todos os lançamentos da clínica logada
  listar: async (req, res) => {
    try {
      const { clinica_id } = req.usuario;
      const { status, busca } = req.query;

      let query = `
                SELECT f.*, p.nome AS paciente_nome, p.telefone AS paciente_tel, p.cpf AS paciente_cpf, p.email AS paciente_email
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

  // Cancelar Lançamento (Paciente Desistiu ou Não Compareceu)
  cancelar: async (req, res) => {
    const connection = await db.getConnection();
    try {
      const { id } = req.params;
      const { clinica_id } = req.usuario;

      await connection.beginTransaction();

      // 1. Atualiza o registro no Financeiro para 'cancelado'
      const [result] = await connection.execute(
        `UPDATE financeiro SET status_pagamento = 'cancelado'
             WHERE id = ? AND clinica_id = ?`,
        [id, clinica_id]
      );

      if (result.affectedRows === 0) {
        throw new Error('Lançamento não encontrado ou acesso negado.');
      }

      // 2. Busca se existe um agendamento_id vinculado
      const [financeiro] = await connection.execute(
        `SELECT agendamento_id FROM financeiro WHERE id = ?`, [id]
      );

      // 3. Se houver agendamento vinculado, altera o status dele para 'cancelado'
      if (financeiro[0] && financeiro[0].agendamento_id) {
        await connection.execute(
          `UPDATE agendamentos SET status_agendamento = 'cancelado' WHERE id = ?`,
          [financeiro[0].agendamento_id]
        );
      }

      await connection.commit();
      res.json({ success: true, message: 'Cancelamento realizado com sucesso!' });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error("ERRO AO CANCELAR:", error.message);
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
        COUNT(CASE WHEN (status_pagamento = 'aberto' AND data_vencimento < CURDATE()) OR status_pagamento = 'cancelado' THEN 1 END) as quantidade_inadimplentes,

        /* CÁLCULO DO TICKET MÉDIO: Soma do Pago / Quantidade de Pagos */
        COALESCE(
            SUM(CASE WHEN status_pagamento = 'pago' THEN valor ELSE 0 END) /
            NULLIF(COUNT(CASE WHEN status_pagamento = 'pago' THEN 1 END), 0),
            0
        ) as ticket_medio

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
  },

  // =============================================================================
  // INJETADO: BUSCAR EXTRATO FINANCEIRO COMPLETO DE UM PACIENTE
  // =============================================================================
  obterExtratoPaciente: async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Sessão inválida." });
    }

    const { pacienteId } = req.params;
    const { clinica_id } = req.usuario;

    try {
      const sql = `
        SELECT id, usuario_id, agendamento_id, tipo, categoria, descricao, valor,
               data_vencimento, data_pagamento, status_pagamento, metodo_pagamento, observacoes
        FROM financeiro
        WHERE paciente_id = ? AND clinica_id = ?
        ORDER BY data_vencimento DESC, id DESC
      `;

      const [lancamentos] = await db.execute(sql, [pacienteId, clinica_id]);

      let totalPago = 0;
      let totalAberto = 0;
      let totalCancelado = 0;

      lancamentos.forEach(item => {
        const valorNum = parseFloat(item.valor) || 0;
        if (item.status_pagamento === 'pago') totalPago += valorNum;
        else if (item.status_pagamento === 'aberto') totalAberto += valorNum;
        else if (item.status_pagamento === 'cancelado') totalCancelado += valorNum;
      });

      res.json({
        resumo: {
          pago: totalPago,
          aberto: totalAberto,
          cancelado: totalCancelado,
          total_geral: totalPago + totalAberto
        },
        dados: lancamentos
      });

    } catch (err) {
      console.error("Erro interno no controller ao obter extrato do paciente:", err);
      res.status(500).json({ erro: 'Erro interno ao buscar o extrato no banco.' });
    }
  }, // <--- COLOQUEI A VÍRGULA AQUI PARA SEPARAR OS MÉTODOS DO OBJETO!

  // =============================================================================
  // INJETADO: CRIAR LANÇAMENTO FINANCEIRO AVULSO (Sem agendamento atrelado)
  // =============================================================================
  criarAvulso: async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Sessão inválida." });
    }

    const { clinica_id } = req.usuario;
    const { paciente_id, tipo, categoria, descricao, valor, data_vencimento, status_pagamento } = req.body;

    if (!paciente_id || !descricao || !valor || !data_vencimento) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    try {
      const sql = `
        INSERT INTO financeiro
          (clinica_id, paciente_id, tipo, categoria, descricao, valor, data_vencimento, status_pagamento, data_pagamento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const dataPagamento = status_pagamento === 'pago' ? new Date() : null;

      const [result] = await db.execute(sql, [
        clinica_id,
        paciente_id,
        tipo || 'receita',
        categoria || 'Consulta',
        descricao,
        valor,
        data_vencimento,
        status_pagamento || 'aberto',
        dataPagamento
      ]);

      res.status(201).json({
        success: true,
        message: "Lançamento avulso registrado com sucesso!",
        id: result.insertId
      });

    } catch (error) {
      console.error("Erro ao criar lançamento avulso no banco:", error);
      res.status(500).json({ error: "Erro interno ao salvar no banco de dados." });
    }
  },
  // =============================================================================
  // 🌟 INJETADO: BUSCAR DADOS DE EMISSÃO DO RECIBO DIRETO DO BANCO DE DADOS
  // =============================================================================
  obterDadosRecibo: async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Sessão inválida." });
    }

    const { pacienteId } = req.params;
    const { clinica_id, id: usuarioId } = req.usuario; // Extrai a clínica e o ID do operador do JWT

    try {
      // Query 100% alinhada com as tabelas 'pacientes', 'clinicas' (nome_clinica) e 'usuarios'
      const query = `
        SELECT
          p.nome AS paciente_nome,
          c.nome_clinica AS clinica_nome,
          u.nome AS operador_nome
        FROM pacientes p
        INNER JOIN clinicas c ON p.clinica_id = c.id
        LEFT JOIN usuarios u ON u.id = ?
        WHERE p.id = ? AND p.clinica_id = ?
      `;

      const [rows] = await db.execute(query, [usuarioId, pacienteId, clinica_id]);

      // Validação de segurança: Paciente não existe ou não pertence à clínica do usuário logado
      if (!rows || rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          error: 'Dados de emissão não localizados no prontuário da clínica.'
        });
      }

      // Devolve os dados blindados e com os nomes corretos para o front-end
      return res.json({
        sucesso: true,
        clinicaNome: rows[0].clinica_nome,
        operadorNome: rows[0].operador_nome || 'Profissional Autorizado',
        pacienteNome: rows[0].paciente_nome
      });

    } catch (error) {
      console.error("Erro interno no controller ao obter dados do recibo:", error);
      return res.status(500).json({
        sucesso: false,
        error: 'Erro interno no servidor ao consultar a base de dados.'
      });
    }
  },
  // =============================================================================
  // 🚀 INJETADO: ENVIAR RECIBO FINANCEIRO COMPLETO POR E-MAIL (MUITO PODER)
  // =============================================================================
  enviarReciboEmail: async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Sessão inválida." });
    }

    const { pacienteId } = req.body;
    const { clinica_id, id: usuarioId } = req.usuario;

    try {
      // 1. Busca dados da Clínica e do Operador Logado
      const [clinicaRows] = await db.execute('SELECT nome_clinica, telefone_clinica FROM clinicas WHERE id = ?', [clinica_id]);
      const [usuarioRows] = await db.execute('SELECT nome FROM usuarios WHERE id = ?', [usuarioId]);

      // 2. Busca os dados e o e-mail do Paciente
      const [pacienteRows] = await db.execute('SELECT nome, email FROM pacientes WHERE id = ? AND clinica_id = ?', [pacienteId, clinica_id]);

      if (!pacienteRows || pacienteRows.length === 0 || !pacienteRows[0].email) {
        return res.status(400).json({ success: false, error: 'Paciente não localizado ou não possui e-mail cadastrado.' });
      }

      const dadosClinica = clinicaRows[0];
      const operadorNome = usuarioRows[0] ? usuarioRows[0].nome : 'Profissional Autorizado';
      const pacienteNome = pacienteRows[0].nome;
      const pacienteEmail = pacienteRows[0].email;

      // 3. Busca os lançamentos financeiros atuais para montar a tabela
      const [lancamentos] = await db.execute(
        `SELECT tipo, categoria, descricao, valor, data_vencimento, status_pagamento
         FROM financeiro WHERE paciente_id = ? AND clinica_id = ? ORDER BY data_vencimento DESC`,
        [pacienteId, clinica_id]
      );

      // Calculo dos saldos idêntico ao que a gaveta faz
      let totalPago = 0;
      let totalAberto = 0;
      let linhasHTML = '';

      lancamentos.forEach(item => {
        const valorNum = parseFloat(item.valor) || 0;
        const dataFormatada = new Date(item.data_vencimento).toLocaleDateString('pt-BR');

        if (item.status_pagamento === 'pago') totalPago += valorNum;
        if (item.status_pagamento === 'aberto') totalAberto += valorNum;

        // Monta cada linha da tabela exatamente com as tags imunes a quebras em gerenciadores de e-mail
        linhasHTML += `
          <tr style="border-bottom: 1px solid #eaf2f8;">
              <td style="padding: 10px 5px; font-size: 13px; color: #2c3e50;">${dataFormatada}</td>
              <td style="padding: 10px 5px; font-size: 13px; font-weight: 600; color: #2c3e50;">${item.descricao}</td>
              <td style="padding: 10px 5px; text-align: right; font-weight: 600; font-size: 13px; color: #2c3e50;">
                R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
          </tr>
        `;
      });

      // Formatadores de moeda locais
      const valorPagoStr = `R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      const valorAbertoStr = `R$ ${totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      const dataEmissao = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // =============================================================================
      // 🌍 CONFIGURAÇÃO DE AMBIENTE (LOCAL VS PRODUÇÃO) - BACK-END
      // =============================================================================
      // 🛑 EM DESENVOLVIMENTO (LOCAL): Aponta para localhost
      const urlPortal = `http://localhost:3000/portal/${pacienteId}`;

      // 🚀 EM PRODUÇÃO (SERVIDOR): Descomente a linha abaixo e comente a de cima quando subir!
      // const urlPortal = `https://medlm.com.br/portal/${pacienteId}`;
      // =============================================================================

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlPortal)}`;

      // 4. Agrupa os pacotes de dados estruturados
      const dadosEmail = {
        pacienteNome,
        pacienteEmail,
        operadorNome,
        dataEmissao,
        linhasHTML,
        valorPago: valorPagoStr,
        valorAberto: valorAbertoStr,
        urlPortal,
        qrCodeUrl
      };

      // 5. Dispara a notificação oficial
      await notificationService.sendReciboEmailNotification(dadosClinica, dadosEmail);

      return res.json({ success: true, message: 'E-mail enviado com sucesso!' });

    } catch (error) {
      console.error("Erro interno no controller ao processar e-mail de recibo:", error);
      return res.status(500).json({ success: false, error: 'Erro interno ao processar disparo do e-mail.' });
    }
  }
};

module.exports = financeiroController;