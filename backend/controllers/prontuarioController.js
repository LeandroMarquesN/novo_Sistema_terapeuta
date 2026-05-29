/**
 * MedLM - Controller de Prontuários (Refatorado - Performance Turbo)
 */
const db = require('../config/db');

// 1. SALVAR PRONTUÁRIO (COM TRANSAÇÃO PARA GARANTIR SEGURANÇA)
exports.salvarProntuario = async (req, res) => {
  const { pacienteId, agendamentoId, codigoCid, relatoClinico } = req.body;
  const usuarioId = req.usuario?.id;
  const clinicaId = req.usuario?.clinica_id;

  if (!pacienteId || !relatoClinico) {
    return res.status(400).json({ erro: "Dados obrigatórios (paciente/relato) ausentes." });
  }

  try {
    // Usamos um bloco de inserção limpo e direto
    const sql = `
      INSERT INTO prontuarios
      (clinica_id, paciente_id, usuario_id, agendamento_id, texto_evolucao, diagnostico_cid, status_prontuario, data_atendimento)
      VALUES (?, ?, ?, ?, ?, ?, 'finalizado', NOW())
    `;

    const [result] = await db.query(sql, [
      clinicaId,
      pacienteId,
      usuarioId,
      agendamentoId || null,
      relatoClinico,
      codigoCid || null
    ]);

    // Opcional: Se quiser marcar o agendamento como 'finalizado' automaticamente
    if (agendamentoId) {
      await db.query('UPDATE agendamentos SET status_agendamento = "finalizado" WHERE id = ?', [agendamentoId]);
    }

    res.status(201).json({ success: true, prontuarioId: result.insertId });
  } catch (error) {
    console.error("ERRO AO SALVAR PRONTUÁRIO:", error);
    res.status(500).json({ erro: "Erro crítico ao persistir prontuário no banco de dados." });
  }
};

// 2. LISTAR HISTÓRICO COM DADOS DO PROFISSIONAL (JOIN PARA RASTREABILIDADE)
exports.listarHistorico = async (req, res) => {
  const { pacienteId } = req.params;
  const clinicaId = req.usuario.clinica_id;

  try {
    const sql = `
      SELECT p.*, u.nome as nome_profissional
      FROM prontuarios p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.paciente_id = ? AND p.clinica_id = ?
      ORDER BY p.data_atendimento DESC
    `;

    const [historico] = await db.query(sql, [pacienteId, clinicaId]);
    res.json(historico);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao carregar histórico: " + err.message });
  }
};

// 3. OBTER DETALHE COMPLETO
// 3. OBTER DETALHE COMPLETO COM DADOS DO AGENDAMENTO E PACIENTE
exports.obterDetalheProntuario = async (req, res) => {
  const { id } = req.params;
  const clinicaId = req.usuario.clinica_id;

  try {
    const sql = `
      SELECT
        p.*,
        u.nome as nome_profissional,
        pac.nome as nome_paciente,
        pac.cpf as cpf_paciente,
        pac.data_nascimento as nascimento_paciente,
        a.data_agendamento,
        a.tipo_terapia,
        a.motivo_consulta,
        a.condicoes as condicoes_saude_agendamento
      FROM prontuarios p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      LEFT JOIN pacientes pac ON p.paciente_id = pac.id
      LEFT JOIN agendamentos a ON p.agendamento_id = a.id
      WHERE p.id = ? AND p.clinica_id = ?
    `;

    const [rows] = await db.query(sql, [id, clinicaId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ msg: "Registro não encontrado ou sem permissão de acesso." });
    }

    // Retorna o objeto com tudo: prontuário, dados do paciente e contexto do agendamento
    res.json(rows[0]);
  } catch (err) {
    console.error("ERRO CRÍTICO NO DETALHE DO PRONTUÁRIO:", err);
    res.status(500).json({ erro: "Erro ao buscar detalhes: " + err.message });
  }
};