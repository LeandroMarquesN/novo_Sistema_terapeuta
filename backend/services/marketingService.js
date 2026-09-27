// services/marketingService.js
const db = require('../config/db');
const { enviarEmailMarketing } = require('./marketingMailerService');
const whatsappService = require('./whatsappService');

// Limite diário de segurança do provedor de e-mail (Brevo)
const LIMITE_DIARIO_ENVIOS = Number(process.env.MARKETING_LIMITE_DIARIO) || 300;
// Pausa entre envios individuais (rate-limit)
const INTERVALO_ENTRE_ENVIOS_MS = Number(process.env.MARKETING_INTERVALO_MS) || 350;

const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lista o público-alvo conforme tipo e canal.
 * tipoPublico: 'todos' | 'individual' | 'filtro'
 * canal: 'email' | 'whatsapp'
 */
exports.listarPublicoAlvo = async (clinicaId, tipoPublico, opcoes = {}, canal = 'email') => {
  const exigeEmail = canal === 'email';
  const exigeTelefone = canal === 'whatsapp';

  // Condição de contato válida
  let contatoClause = '1=1';
  if (exigeEmail) {
    contatoClause = `p.email IS NOT NULL AND p.email <> ''`;
  } else if (exigeTelefone) {
    contatoClause = `p.telefone IS NOT NULL AND p.telefone <> ''`;
  }

  // ─── Individual ───
  if (tipoPublico === 'individual') {
    const ids = opcoes.pacienteIds || [];
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT p.id, p.nome, p.email, p.telefone
       FROM pacientes p
       WHERE p.clinica_id = ? AND p.id IN (${placeholders})
         AND p.ativo = 1 AND p.aceita_marketing = 1
         AND ${contatoClause}`,
      [clinicaId, ...ids]
    );
    return rows;
  }

  // ─── Filtros ───
  // Aceita tanto o formato antigo (statusConsulta) quanto o do front (tipo / data-filtro)
  const filtroTipo =
    opcoes.filtro?.statusConsulta ||
    opcoes.filtro?.tipo ||
    opcoes.filtro ||
    null;

  if (tipoPublico === 'filtro' && (filtroTipo === 'sem_retorno_90d' || filtroTipo === 'sem_retorno')) {
    const [rows] = await db.query(
      `SELECT p.id, p.nome, p.email, p.telefone
       FROM pacientes p
       LEFT JOIN agendamentos a ON a.paciente_id = p.id
       WHERE p.clinica_id = ? AND p.ativo = 1 AND p.aceita_marketing = 1
         AND ${contatoClause}
       GROUP BY p.id
       HAVING MAX(a.data_agendamento) < DATE_SUB(NOW(), INTERVAL 90 DAY)
           OR MAX(a.data_agendamento) IS NULL`,
      [clinicaId]
    );
    return rows;
  }

  if (tipoPublico === 'filtro' && (filtroTipo === 'aniversariantes_mes' || filtroTipo === 'aniversariantes')) {
    const [rows] = await db.query(
      `SELECT p.id, p.nome, p.email, p.telefone
       FROM pacientes p
       WHERE p.clinica_id = ? AND p.ativo = 1 AND p.aceita_marketing = 1
         AND p.data_nascimento IS NOT NULL
         AND MONTH(p.data_nascimento) = MONTH(CURDATE())
         AND ${contatoClause}`,
      [clinicaId]
    );
    return rows;
  }

  // ─── Todos (default) ───
  const [rows] = await db.query(
    `SELECT p.id, p.nome, p.email, p.telefone
     FROM pacientes p
     WHERE p.clinica_id = ? AND p.ativo = 1 AND p.aceita_marketing = 1
       AND ${contatoClause}`,
    [clinicaId]
  );
  return rows;
};

/**
 * Cria a campanha + filas de envio.
 * NÃO dispara ainda — isso é feito por processarCampanha().
 */
exports.criarCampanha = async (clinicaId, usuarioId, dados) => {
  const {
    titulo,
    assunto = '',
    corpoHtml,
    tipoPublico,
    opcoesPublico = {},
    canal = 'email',
    rascunho = false
  } = dados;

  const destinatarios = await exports.listarPublicoAlvo(
    clinicaId,
    tipoPublico,
    opcoesPublico,
    canal
  );

  // Status inicial
  const statusInicial = rascunho ? 'rascunho' : 'processando';

  const [resultCampanha] = await db.query(
    `INSERT INTO marketing_campanhas
       (clinica_id, criado_por_usuario_id, titulo, assunto, corpo_html,
        tipo_publico, filtro_json, status, total_destinatarios, canal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clinicaId,
      usuarioId,
      titulo,
      assunto,
      corpoHtml,
      tipoPublico,
      JSON.stringify(opcoesPublico || {}),
      statusInicial,
      destinatarios.length,
      canal
    ]
  );
  const campanhaId = resultCampanha.insertId;

  // Insere a fila de envios
  if (destinatarios.length) {
    if (canal === 'whatsapp') {
      const values = destinatarios.map((p) => [
        campanhaId,
        p.id,
        p.telefone || null,   // telefone_destino
        null                  // email_destino
      ]);
      await db.query(
        `INSERT INTO marketing_envios
           (campanha_id, paciente_id, telefone_destino, email_destino)
         VALUES ?`,
        [values]
      );
    } else {
      const values = destinatarios.map((p) => [
        campanhaId,
        p.id,
        null,                 // telefone_destino
        p.email || null       // email_destino
      ]);
      await db.query(
        `INSERT INTO marketing_envios
           (campanha_id, paciente_id, telefone_destino, email_destino)
         VALUES ?`,
        [values]
      );
    }
  }

  return { campanhaId, totalDestinatarios: destinatarios.length };
};

/**
 * Processa a fila em background (e-mail ou WhatsApp).
 * Chamar com .catch() sem await no controller.
 */
exports.processarCampanha = async (campanhaId) => {
  const [[campanha]] = await db.query(
    `SELECT * FROM marketing_campanhas WHERE id = ?`,
    [campanhaId]
  );
  if (!campanha) return;
  if (campanha.status === 'rascunho') return; // não processa rascunhos

  await db.query(
    `UPDATE marketing_campanhas
     SET status = 'processando', iniciado_em = NOW()
     WHERE id = ?`,
    [campanhaId]
  );

  const canal = campanha.canal || 'email';

  // Busca pendentes (compatível com as duas colunas de contato)
  const [pendentes] = await db.query(
    `SELECT me.id,
            me.email_destino,
            me.telefone_destino,
            p.nome
     FROM marketing_envios me
     JOIN pacientes p ON p.id = me.paciente_id
     WHERE me.campanha_id = ? AND me.status = 'pendente'`,
    [campanhaId]
  );

  // Limite diário só faz sentido para e-mail (Brevo)
  let jaEnviadosHoje = 0;
  if (canal === 'email') {
    const [[{ enviadosHoje }]] = await db.query(
      `SELECT COUNT(*) AS enviadosHoje
       FROM marketing_envios
       WHERE status = 'enviado' AND DATE(enviado_em) = CURDATE()`
    );
    jaEnviadosHoje = enviadosHoje || 0;
  }

  let sucesso = 0;
  let falha = 0;

  for (const item of pendentes) {
    // Respeita limite diário de e-mail
    if (canal === 'email' && jaEnviadosHoje >= LIMITE_DIARIO_ENVIOS) {
      break;
    }

    const mensagemPersonalizada = (campanha.corpo_html || '')
      .replace(/{{\s*nome_paciente\s*}}/gi, item.nome || '');

    try {
      if (canal === 'whatsapp') {
        if (!item.telefone_destino) {
          throw new Error('Paciente sem telefone cadastrado');
        }
        // Abate 1 crédito dentro do próprio whatsappService
        await whatsappService.enviarWhatsApp(
          campanha.clinica_id,
          item.telefone_destino,
          // Remove tags HTML simples para WhatsApp (texto puro)
          mensagemPersonalizada
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .trim()
        );
      } else {
        // E-mail (Brevo)
        if (!item.email_destino) {
          throw new Error('Paciente sem e-mail cadastrado');
        }
        await enviarEmailMarketing({
          nomeClinica: campanha.titulo,
          destinatario: item.email_destino,
          assunto: campanha.assunto,
          corpoHtml: mensagemPersonalizada,
        });
      }

      await db.query(
        `UPDATE marketing_envios
         SET status = 'enviado', enviado_em = NOW()
         WHERE id = ?`,
        [item.id]
      );
      sucesso++;
      if (canal === 'email') jaEnviadosHoje++;
    } catch (err) {
      await db.query(
        `UPDATE marketing_envios
         SET status = 'falhou', erro = ?
         WHERE id = ?`,
        [err.message || 'Erro desconhecido', item.id]
      );
      falha++;
    }

    await aguardar(INTERVALO_ENTRE_ENVIOS_MS);
  }

  const restam = pendentes.length - sucesso - falha;
  const statusFinal =
    restam > 0
      ? 'processando'
      : falha > 0
        ? 'concluida_com_falhas'
        : 'concluida';

  await db.query(
    `UPDATE marketing_campanhas
     SET status = ?,
         total_enviados = total_enviados + ?,
         total_falhas = total_falhas + ?,
         concluido_em = ?
     WHERE id = ?`,
    [statusFinal, sucesso, falha, restam > 0 ? null : new Date(), campanhaId]
  );
};

/**
 * Autocomplete – nome, CPF ou telefone.
 * Não força e-mail (importante para WhatsApp).
 */
exports.buscarPacientesPorTermo = async (clinicaId, termo) => {
  const termoBusca = `%${termo}%`;
  const [rows] = await db.query(
    `SELECT id, nome, cpf, email, telefone
     FROM pacientes
     WHERE clinica_id = ? AND ativo = 1
       AND (nome LIKE ? OR cpf LIKE ? OR telefone LIKE ?)
     ORDER BY nome ASC
     LIMIT 12`,
    [clinicaId, termoBusca, termoBusca, termoBusca]
  );
  return rows;
};

/**
 * Lista campanhas com paginação e filtros.
 */
exports.listarCampanhas = async (clinicaId, opcoes = {}) => {
  const pagina = Math.max(1, Number(opcoes.pagina) || 1);
  const porPagina = Math.min(50, Number(opcoes.porPagina) || 10);
  const offset = (pagina - 1) * porPagina;

  const condicoes = ['clinica_id = ?'];
  const params = [clinicaId];

  if (opcoes.status) {
    condicoes.push('status = ?');
    params.push(opcoes.status);
  }
  if (opcoes.busca) {
    condicoes.push('(titulo LIKE ? OR assunto LIKE ?)');
    params.push(`%${opcoes.busca}%`, `%${opcoes.busca}%`);
  }

  const whereClause = condicoes.join(' AND ');

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM marketing_campanhas WHERE ${whereClause}`,
    params
  );

  const [rows] = await db.query(
    `SELECT id, titulo, assunto, tipo_publico, status,
            total_destinatarios, total_enviados, total_falhas,
            canal, criado_em
     FROM marketing_campanhas
     WHERE ${whereClause}
     ORDER BY criado_em DESC
     LIMIT ? OFFSET ?`,
    [...params, porPagina, offset]
  );

  return {
    campanhas: rows,
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
};
