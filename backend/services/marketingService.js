// services/marketingService.js
const db = require('../config/db');
const { enviarEmailMarketing } = require('./marketingMailerService');

// Limite diário de segurança do provedor (ajuste conforme seu plano no Brevo).
// Serve pra pausar o processamento antes de bater no limite e tomar erro 4xx do provedor.
const LIMITE_DIARIO_ENVIOS = Number(process.env.MARKETING_LIMITE_DIARIO) || 300;

// Pausa entre envios individuais, pra não estourar rate limit por segundo do provedor.
const INTERVALO_ENTRE_ENVIOS_MS = Number(process.env.MARKETING_INTERVALO_MS) || 350;

const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retorna os pacientes que fariam parte de uma campanha, dado o tipo de público
 * e (opcionalmente) uma lista de IDs específicos ou um filtro.
 *
 * tipoPublico: 'todos' | 'individual' | 'filtro'
 * opcoes.pacienteIds: array de IDs (quando tipoPublico = 'individual')
 * opcoes.filtro: { statusConsulta: 'sem_retorno_90d' | 'ativos' } (extensível)
 */
exports.listarPublicoAlvo = async (clinicaId, tipoPublico, opcoes = {}) => {
  if (tipoPublico === 'individual') {
    const ids = opcoes.pacienteIds || [];
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id, nome, email FROM pacientes
       WHERE clinica_id = ? AND id IN (${placeholders}) AND email IS NOT NULL AND email <> '' AND aceita_marketing = 1`,
      [clinicaId, ...ids]
    );
    return rows;
  }

  if (tipoPublico === 'filtro' && opcoes.filtro?.statusConsulta === 'sem_retorno_90d') {
    const [rows] = await db.query(
      `SELECT p.id, p.nome, p.email
       FROM pacientes p
       LEFT JOIN agendamentos a ON a.paciente_id = p.id
       WHERE p.clinica_id = ? AND p.email IS NOT NULL AND p.email <> '' AND p.aceita_marketing = 1
       GROUP BY p.id
       HAVING MAX(a.data_agendamento) < DATE_SUB(NOW(), INTERVAL 90 DAY) OR MAX(a.data_agendamento) IS NULL`,
      [clinicaId]
    );
    return rows;
  }

  if (tipoPublico === 'filtro' && opcoes.filtro?.statusConsulta === 'aniversariantes_mes') {
    const [rows] = await db.query(
      `SELECT id, nome, email FROM pacientes
       WHERE clinica_id = ? AND email IS NOT NULL AND email <> '' AND aceita_marketing = 1
         AND data_nascimento IS NOT NULL
         AND MONTH(data_nascimento) = MONTH(CURDATE())`,
      [clinicaId]
    );
    return rows;
  }

  // 'todos' (default)
  const [rows] = await db.query(
    `SELECT id, nome, email FROM pacientes
     WHERE clinica_id = ? AND email IS NOT NULL AND email <> '' AND aceita_marketing = 1`,
    [clinicaId]
  );
  return rows;
};

/**
 * Cria a campanha e já insere as linhas de fila (status pendente).
 * NÃO envia nada ainda — o disparo real acontece em processarCampanha().
 */
exports.criarCampanha = async (clinicaId, usuarioId, dados) => {
  const { titulo, assunto, corpoHtml, tipoPublico, opcoesPublico } = dados;

  const destinatarios = await exports.listarPublicoAlvo(clinicaId, tipoPublico, opcoesPublico);

  const [resultCampanha] = await db.query(
    `INSERT INTO marketing_campanhas
       (clinica_id, criado_por_usuario_id, titulo, assunto, corpo_html, tipo_publico, filtro_json, status, total_destinatarios)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'rascunho', ?)`,
    [clinicaId, usuarioId, titulo, assunto, corpoHtml, tipoPublico, JSON.stringify(opcoesPublico || {}), destinatarios.length]
  );
  const campanhaId = resultCampanha.insertId;

  if (destinatarios.length) {
    const values = destinatarios.map((p) => [campanhaId, p.id, p.email]);
    await db.query(
      `INSERT INTO marketing_envios (campanha_id, paciente_id, email_destino) VALUES ?`,
      [values]
    );
  }

  return { campanhaId, totalDestinatarios: destinatarios.length };
};

/**
 * Processa a fila de uma campanha em background (não bloqueia a requisição HTTP).
 * Chame isso com `.catch(console.error)` sem `await` no controller.
 */
exports.processarCampanha = async (campanhaId) => {
  const [[campanha]] = await db.query(`SELECT * FROM marketing_campanhas WHERE id = ?`, [campanhaId]);
  if (!campanha) return;

  await db.query(`UPDATE marketing_campanhas SET status = 'processando', iniciado_em = NOW() WHERE id = ?`, [campanhaId]);

  const [pendentes] = await db.query(
    `SELECT me.id, me.email_destino, p.nome FROM marketing_envios me
     JOIN pacientes p ON p.id = me.paciente_id
     WHERE me.campanha_id = ? AND me.status = 'pendente'`,
    [campanhaId]
  );

  const [[{ enviadosHoje }]] = await db.query(
    `SELECT COUNT(*) AS enviadosHoje FROM marketing_envios
     WHERE status = 'enviado' AND DATE(enviado_em) = CURDATE()`
  );

  let jaEnviadosHoje = enviadosHoje;
  let sucesso = 0;
  let falha = 0;

  for (const item of pendentes) {
    if (jaEnviadosHoje >= LIMITE_DIARIO_ENVIOS) {
      // Estourou o limite diário do provedor — o restante fica 'pendente'
      // e um cron/worker pode rodar processarCampanha() de novo amanhã.
      break;
    }

    try {
      await enviarEmailMarketing({
        nomeClinica: campanha.titulo, // trocar por nome_clinica real via join se preferir
        destinatario: item.email_destino,
        assunto: campanha.assunto,
        corpoHtml: campanha.corpo_html.replace(/{{\s*nome_paciente\s*}}/g, item.nome),
      });

      await db.query(`UPDATE marketing_envios SET status = 'enviado', enviado_em = NOW() WHERE id = ?`, [item.id]);
      sucesso++;
      jaEnviadosHoje++;
    } catch (err) {
      await db.query(`UPDATE marketing_envios SET status = 'falhou', erro = ? WHERE id = ?`, [err.message, item.id]);
      falha++;
    }

    await aguardar(INTERVALO_ENTRE_ENVIOS_MS);
  }

  const restam = pendentes.length - sucesso - falha;
  const statusFinal = restam > 0 ? 'processando' : falha > 0 ? 'concluida_com_falhas' : 'concluida';

  await db.query(
    `UPDATE marketing_campanhas
     SET status = ?, total_enviados = total_enviados + ?, total_falhas = total_falhas + ?, concluido_em = ?
     WHERE id = ?`,
    [statusFinal, sucesso, falha, restam > 0 ? null : new Date(), campanhaId]
  );
};

exports.listarCampanhas = async (clinicaId) => {
  const [rows] = await db.query(
    `SELECT id, titulo, assunto, tipo_publico, status, total_destinatarios, total_enviados, total_falhas, criado_em
     FROM marketing_campanhas WHERE clinica_id = ? ORDER BY criado_em DESC`,
    [clinicaId]
  );
  return rows;
};
