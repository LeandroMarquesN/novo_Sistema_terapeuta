const path = require('path');
const db = require('../config/db');

// Nome técnico da feature cadastrada na tabela `features` (ver seed em
// agenda_avancada_feature_seed.sql). Ajuste aqui caso troque o nome no banco.
const FEATURE_KEY = 'agenda_avancada';

// Cargos considerados "profissionais de saúde" para a Camada 1 (seleção de
// profissional). Recepção/admin/dono não entram na lista de agenda pessoal.
const CARGOS_PROFISSIONAIS = [
  'terapeuta', 'medico', 'psicologo', 'fisioterapeuta',
  'nutricionista', 'fonoaudiologo', 'profissional da saude'
];

// =============================================================================
// HELPER — verifica se a clínica tem a feature "agenda_avancada" habilitada
// Regra: clinica_features (override específico da clínica) tem prioridade;
// se não houver override, cai para o padrão definido em plano_features.
// =============================================================================
async function featureHabilitada(clinicaId) {
  const [rows] = await db.query(
    `SELECT
        COALESCE(cf.is_enabled, pf.is_enabled, 0) AS habilitado
     FROM clinicas c
     JOIN planos p ON p.id = c.plano_id
     LEFT JOIN features f ON f.nome_tecnico = ?
     LEFT JOIN clinica_features cf ON cf.clinica_id = c.id AND cf.feature_id = f.id
     LEFT JOIN plano_features pf ON pf.plano_id = c.plano_id AND pf.feature_id = f.id
     WHERE c.id = ?
     LIMIT 1`,
    [FEATURE_KEY, clinicaId]
  );

  if (!rows.length) return false;
  return !!rows[0].habilitado;
}

// =============================================================================
// 1. RENDERIZAÇÃO DA PÁGINA (valida feature flag antes de liberar a tela)
// =============================================================================
async function paginaAgendaAvancada(req, res) {
  try {
    const clinicaId = req.usuario?.clinica_id;
    if (!clinicaId) {
      return res.status(403).send('Erro de identificação da clínica. Faça login novamente.');
    }

    const habilitado = await featureHabilitada(clinicaId);

    if (!habilitado) {
      // Tela amigável de upgrade — mantém a mesma paleta dark/emerald do sistema
      return res.status(200).send(telaDeUpgrade());
    }

    const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');
    return res.sendFile(path.join(frontendPath, 'pages', 'agendaAvancada.html'));

  } catch (error) {
    console.error('Erro ao carregar Agenda Avançada:', error);
    res.status(500).send('Erro interno ao carregar a Agenda Avançada.');
  }
}

function telaDeUpgrade() {
  return `<!DOCTYPE html>
  <html lang="pt-BR"><head><meta charset="UTF-8">
  <title>MedLM - Agenda Avançada</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background-color:#020c12;font-family:'Inter',sans-serif;color:#cbd5e1;text-align:center;padding:24px;
      background-image:radial-gradient(ellipse 80% 60% at 10% 0%, rgba(8,145,178,0.20) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 90% 100%, rgba(5,150,105,0.18) 0%, transparent 60%);}
    .box{max-width:420px;background:rgba(255,255,255,0.03);border:1px solid rgba(251,191,36,0.3);
      border-radius:24px;padding:36px 28px;}
    .icon{width:72px;height:72px;border-radius:20px;margin:0 auto 20px;display:flex;align-items:center;
      justify-content:center;font-size:30px;color:#fbbf24;background:rgba(251,191,36,0.12);
      border:1px solid rgba(251,191,36,0.3);}
    h1{font-family:'Space Grotesk',sans-serif;color:#f1f5f9;font-size:20px;margin:0 0 10px;}
    p{font-size:13px;color:rgba(148,163,184,0.7);line-height:1.6;margin:0 0 24px;}
    a{display:inline-block;background:linear-gradient(135deg,#0891b2 0%,#059669 100%);color:#fff;
      text-decoration:none;font-weight:700;padding:12px 26px;border-radius:12px;font-family:'Space Grotesk',sans-serif;}
  </style></head>
  <body>
    <div class="box">
      <div class="icon"><i class="fas fa-lock"></i></div>
      <h1>Agenda Avançada é um recurso PRO</h1>
      <p>Sua clínica ainda não tem esse pacote habilitado. Fale com o time MedLM para liberar a grade horária avançada, dark mode e drag-and-drop de agendamentos.</p>
      <a href="/dashboard/configuracoes">Ver planos e upgrade</a>
    </div>
  </body></html>`;
}

// =============================================================================
// 2. CAMADA 1 — Lista de profissionais da clínica
// =============================================================================
async function listarProfissionais(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });

  try {
    const placeholders = CARGOS_PROFISSIONAIS.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id, nome, cargo, crm, uf_crm
       FROM usuarios
       WHERE clinica_id = ? AND cargo IN (${placeholders})
       ORDER BY nome ASC`,
      [clinicaId, ...CARGOS_PROFISSIONAIS]
    );
    res.json({ success: true, profissionais: rows });
  } catch (error) {
    console.error('Erro ao listar profissionais:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar profissionais.' });
  }
}

// =============================================================================
// 3. CAMADA 2 — Indicadores do ano (dias com agendamento, por mês)
// =============================================================================
async function indicadoresAno(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const { profissionalId, ano } = req.query;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });
  if (!profissionalId || !ano) return res.status(400).json({ success: false, message: 'Parâmetros ausentes.' });

  try {
    const [rows] = await db.query(
      `SELECT DATE(data_agendamento) AS dia, COUNT(*) AS total
       FROM agendamentos
       WHERE clinica_id = ? AND usuario_id = ?
         AND YEAR(data_agendamento) = ?
         AND status_agendamento != 'cancelado'
       GROUP BY DATE(data_agendamento)`,
      [clinicaId, profissionalId, ano]
    );
    res.json({ success: true, dias: rows });
  } catch (error) {
    console.error('Erro ao buscar indicadores do ano:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar panorama anual.' });
  }
}

// =============================================================================
// 4. CAMADA 3 — Dias do mês com contagem de agendamentos
// =============================================================================
async function diasDoMes(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const { profissionalId, ano, mes } = req.query;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });
  if (!profissionalId || !ano || !mes) return res.status(400).json({ success: false, message: 'Parâmetros ausentes.' });

  try {
    const [rows] = await db.query(
      `SELECT DATE(data_agendamento) AS dia, COUNT(*) AS total
       FROM agendamentos
       WHERE clinica_id = ? AND usuario_id = ?
         AND YEAR(data_agendamento) = ? AND MONTH(data_agendamento) = ?
         AND status_agendamento != 'cancelado'
       GROUP BY DATE(data_agendamento)`,
      [clinicaId, profissionalId, ano, mes]
    );
    res.json({ success: true, dias: rows });
  } catch (error) {
    console.error('Erro ao buscar dias do mês:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar o mês.' });
  }
}

// =============================================================================
// 5. CAMADA 4 — Grade de colunas (intervalo de datas) para a semana/período
// =============================================================================
async function gradeIntervalo(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const { profissionalId, inicio, fim } = req.query;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });
  if (!profissionalId || !inicio || !fim) return res.status(400).json({ success: false, message: 'Parâmetros ausentes.' });

  try {
    const [rows] = await db.query(
      `SELECT a.id, a.paciente_id, a.nome, a.telefone, a.data_agendamento,
              a.status_agendamento, a.tipo_terapia, a.motivo_consulta,
              p.origem AS origem_paciente
       FROM agendamentos a
       LEFT JOIN pacientes p ON p.id = a.paciente_id
       WHERE a.clinica_id = ? AND a.usuario_id = ?
         AND a.data_agendamento BETWEEN ? AND ?
       ORDER BY a.data_agendamento ASC`,
      [clinicaId, profissionalId, inicio, fim]
    );
    res.json({ success: true, agendamentos: rows });
  } catch (error) {
    console.error('Erro ao buscar grade de agendamentos:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar a grade.' });
  }
}

// =============================================================================
// 6. Agendamentos de HOJE (botão "Hoje" do rodapé) — lista linear consolidada
// =============================================================================
async function agendamentosHoje(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const { profissionalId } = req.query;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });

  try {
    let sql = `SELECT a.id, a.paciente_id, a.nome, a.telefone, a.data_agendamento,
                      a.status_agendamento, a.tipo_terapia, p.origem AS origem_paciente
               FROM agendamentos a
               LEFT JOIN pacientes p ON p.id = a.paciente_id
               WHERE a.clinica_id = ? AND DATE(a.data_agendamento) = CURDATE()
                 AND a.status_agendamento != 'cancelado'`;
    const params = [clinicaId];

    if (profissionalId) {
      sql += ' AND a.usuario_id = ?';
      params.push(profissionalId);
    }
    sql += ' ORDER BY a.data_agendamento ASC';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, agendamentos: rows });
  } catch (error) {
    console.error('Erro ao buscar agendamentos de hoje:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar os agendamentos de hoje.' });
  }
}

// =============================================================================
// 7. Criação rápida de agendamento (toque em célula vazia da grade)
// =============================================================================
async function criarAgendamento(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const usuarioLogadoId = req.usuario?.id;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });

  const { paciente_id, usuario_id, data_agendamento, tipo_terapia, motivo_consulta } = req.body;

  if (!paciente_id || !usuario_id || !data_agendamento) {
    return res.status(400).json({ success: false, message: 'Paciente, profissional e data/horário são obrigatórios.' });
  }

  try {
    // Confirma que o paciente pertence à mesma clínica (nunca confiar em IDs vindos do front)
    const [[paciente]] = await db.query(
      `SELECT id, nome, telefone FROM pacientes WHERE id = ? AND clinica_id = ?`,
      [paciente_id, clinicaId]
    );
    if (!paciente) return res.status(404).json({ success: false, message: 'Paciente não encontrado nesta clínica.' });

    const [resultado] = await db.query(
      `INSERT INTO agendamentos
        (clinica_id, paciente_id, usuario_id, data_agendamento, status_agendamento, nome, telefone, tipo_terapia, motivo_consulta)
       VALUES (?, ?, ?, ?, 'aguardando_sinal', ?, ?, ?, ?)`,
      [clinicaId, paciente_id, usuario_id, data_agendamento, paciente.nome, paciente.telefone, tipo_terapia || null, motivo_consulta || null]
    );

    res.status(201).json({ success: true, id: resultado.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Já existe um agendamento ativo nesse horário.' });
    }
    console.error('Erro ao criar agendamento (agenda avançada):', error);
    res.status(500).json({ success: false, message: 'Erro ao criar agendamento.' });
  }
}

// =============================================================================
// 8. Atualização (reagendar / editar / drag-and-drop)
// =============================================================================
async function atualizarAgendamento(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const { id } = req.params;
  const { data_agendamento, tipo_terapia, motivo_consulta, status_agendamento } = req.body;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });

  try {
    const campos = [];
    const valores = [];

    if (data_agendamento) { campos.push('data_agendamento = ?'); valores.push(data_agendamento); }
    if (tipo_terapia !== undefined) { campos.push('tipo_terapia = ?'); valores.push(tipo_terapia); }
    if (motivo_consulta !== undefined) { campos.push('motivo_consulta = ?'); valores.push(motivo_consulta); }
    if (status_agendamento) { campos.push('status_agendamento = ?'); valores.push(status_agendamento); }

    if (!campos.length) return res.status(400).json({ success: false, message: 'Nada para atualizar.' });

    valores.push(id, clinicaId);

    const [resultado] = await db.query(
      `UPDATE agendamentos SET ${campos.join(', ')} WHERE id = ? AND clinica_id = ?`,
      valores
    );

    if (!resultado.affectedRows) return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Já existe um agendamento ativo nesse horário.' });
    }
    console.error('Erro ao atualizar agendamento (agenda avançada):', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar agendamento.' });
  }
}

// =============================================================================
// 9. Duplicar agendamento
// =============================================================================
async function duplicarAgendamento(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const { id } = req.params;
  const { nova_data } = req.body;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });
  if (!nova_data) return res.status(400).json({ success: false, message: 'Informe a nova data/horário.' });

  try {
    const [[original]] = await db.query(
      `SELECT paciente_id, usuario_id, nome, telefone, tipo_terapia, motivo_consulta
       FROM agendamentos WHERE id = ? AND clinica_id = ?`,
      [id, clinicaId]
    );
    if (!original) return res.status(404).json({ success: false, message: 'Agendamento original não encontrado.' });

    const [resultado] = await db.query(
      `INSERT INTO agendamentos
        (clinica_id, paciente_id, usuario_id, data_agendamento, status_agendamento, nome, telefone, tipo_terapia, motivo_consulta)
       VALUES (?, ?, ?, ?, 'aguardando_sinal', ?, ?, ?, ?)`,
      [clinicaId, original.paciente_id, original.usuario_id, nova_data, original.nome, original.telefone, original.tipo_terapia, original.motivo_consulta]
    );

    res.status(201).json({ success: true, id: resultado.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Já existe um agendamento ativo nesse horário.' });
    }
    console.error('Erro ao duplicar agendamento:', error);
    res.status(500).json({ success: false, message: 'Erro ao duplicar agendamento.' });
  }
}

// =============================================================================
// 10. Cancelar / apagar (soft delete — segue o padrão do resto do sistema)
// =============================================================================
async function cancelarAgendamento(req, res) {
  const clinicaId = req.usuario?.clinica_id;
  const { id } = req.params;
  if (!clinicaId) return res.status(401).json({ success: false, message: 'Não autenticado.' });

  try {
    const [resultado] = await db.query(
      `UPDATE agendamentos SET status_agendamento = 'cancelado' WHERE id = ? AND clinica_id = ?`,
      [id, clinicaId]
    );
    if (!resultado.affectedRows) return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ success: false, message: 'Erro ao cancelar agendamento.' });
  }
}

module.exports = {
  paginaAgendaAvancada,
  listarProfissionais,
  indicadoresAno,
  diasDoMes,
  gradeIntervalo,
  agendamentosHoje,
  criarAgendamento,
  atualizarAgendamento,
  duplicarAgendamento,
  cancelarAgendamento
};
