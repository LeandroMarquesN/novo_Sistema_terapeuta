/**
 * MedLM - Controller de Solicitação de Exames e Vitaminas
 * Conformidade: autoria da sessão + snapshot CRM/UF + trilha de auditoria + imutabilidade
 */
const db = require('../config/db');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const crypto = require('crypto');
// =========================================================
// 1. BUSCAR CATÁLOGO DE EXAMES (global + da clínica)
// =========================================================
exports.listarCatalogo = async (req, res) => {
    const clinicaId = req.usuario.clinica_id;

    try {
        const [rows] = await db.query(
            `SELECT id, categoria, nome_exame, codigo_tuss, instrucoes_padrao, pacote_sugerido
       FROM catalogo_exames
       WHERE (clinica_id IS NULL OR clinica_id = ?)
         AND ativo = 1
       ORDER BY categoria, nome_exame`,
            [clinicaId]
        );

        // Agrupa por categoria para facilitar o frontend
        const agrupado = rows.reduce((acc, item) => {
            if (!acc[item.categoria]) acc[item.categoria] = [];
            acc[item.categoria].push(item);
            return acc;
        }, {});

        res.json({
            total: rows.length,
            categorias: Object.keys(agrupado),
            exames: agrupado
        });
    } catch (err) {
        console.error('ERRO AO LISTAR CATÁLOGO:', err);
        res.status(500).json({ erro: 'Erro ao carregar catálogo de exames.' });
    }
};

// =========================================================
// 2. SALVAR / EMITIR SOLICITAÇÃO DE EXAMES
// =========================================================
exports.salvarSolicitacao = async (req, res) => {
    const {
        pacienteId,
        agendamentoId,
        prontuarioId,
        titulo,
        observacoes,
        prioridade = 'rotina',
        itens,                 // array de exames selecionados
        senhaAssinatura,
        apenasRascunho = false
    } = req.body;

    const usuarioId = req.usuario?.id;
    const clinicaId = req.usuario?.clinica_id;

    if (!pacienteId || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({
            erro: 'Paciente e pelo menos um exame são obrigatórios.'
        });
    }

    if (!apenasRascunho && !senhaAssinatura) {
        return res.status(400).json({
            erro: 'Senha de assinatura é obrigatória para emitir a solicitação.'
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Busca dados do profissional (snapshot jurídico)
        const [userRows] = await conn.query(
            'SELECT nome, crm, uf_crm, senha FROM usuarios WHERE id = ? AND clinica_id = ?',
            [usuarioId, clinicaId]
        );

        if (!userRows.length) {
            await conn.rollback();
            return res.status(401).json({ erro: 'Usuário não encontrado.' });
        }

        const profissional = userRows[0];

        // 2. Valida senha se for emissão
        if (!apenasRascunho) {
            const senhaValida = senhaAssinatura === profissional.senha; // TODO: migrar para bcrypt
            if (!senhaValida) {
                await conn.rollback();
                return res.status(401).json({ erro: 'Senha incorreta. Assinatura não confirmada.' });
            }
        }

        const status = apenasRascunho ? 'rascunho' : 'emitido';
        const dataEmissao = apenasRascunho ? null : new Date();

        // 3. Insere o cabeçalho da solicitação
        const [result] = await conn.query(
            `INSERT INTO solicitacoes_exames
       (clinica_id, paciente_id, usuario_id, agendamento_id, prontuario_id,
        profissional_nome, profissional_crm, profissional_uf_crm,
        titulo, observacoes, prioridade,
        status_solicitacao, data_emissao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                clinicaId,
                pacienteId,
                usuarioId,
                agendamentoId || null,
                prontuarioId || null,
                profissional.nome,
                profissional.crm,
                profissional.uf_crm,
                titulo || null,
                observacoes || null,
                prioridade,
                status,
                dataEmissao
            ]
        );

        const solicitacaoId = result.insertId;

        // 4. Insere os itens (exames)
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            await conn.query(
                `INSERT INTO solicitacao_exame_itens
         (solicitacao_id, ordem, categoria, nome_exame, codigo_tuss, instrucoes)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    solicitacaoId,
                    i + 1,
                    item.categoria || 'Geral',
                    item.nome_exame,
                    item.codigo_tuss || null,
                    item.instrucoes || null
                ]
            );
        }

        await conn.commit();

        // 5. Auditoria
        await auditService.registrarLog(
            usuarioId,
            'solicitacao_exame',
            solicitacaoId,
            apenasRascunho ? 'CRIOU_RASCUNHO' : 'EMITIU_COM_SENHA',
            {
                crm: profissional.crm,
                uf_crm: profissional.uf_crm,
                prontuarioId
            }
        );

        res.status(201).json({
            success: true,
            solicitacaoId,
            status,
            message: apenasRascunho
                ? 'Rascunho de solicitação salvo com sucesso.'
                : 'Solicitação de exames emitida e assinada com sucesso.'
        });

    } catch (error) {
        await conn.rollback();
        console.error('ERRO AO SALVAR SOLICITAÇÃO DE EXAMES:', error);
        res.status(500).json({ erro: 'Erro crítico ao persistir solicitação de exames.' });
    } finally {
        conn.release();
    }
};

// =========================================================
// 3. LISTAR SOLICITAÇÕES DO PACIENTE
// =========================================================
exports.listarSolicitacoes = async (req, res) => {
    const { pacienteId } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        const [rows] = await db.query(
            `SELECT 
         s.id,
         s.titulo,
         s.prioridade,
         s.status_solicitacao,
         s.data_emissao,
         s.criado_em,
         s.profissional_nome,
         s.profissional_crm,
         s.profissional_uf_crm,
         (SELECT COUNT(*) FROM solicitacao_exame_itens WHERE solicitacao_id = s.id) AS total_exames
       FROM solicitacoes_exames s
       WHERE s.paciente_id = ? AND s.clinica_id = ?
       ORDER BY s.criado_em DESC`,
            [pacienteId, clinicaId]
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// =========================================================
// 4. DETALHE COMPLETO DA SOLICITAÇÃO (com itens)
// =========================================================
exports.obterDetalheSolicitacao = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT s.*,
              p.nome AS nome_paciente,
              p.cpf AS cpf_paciente
       FROM solicitacoes_exames s
       JOIN pacientes p ON s.paciente_id = p.id
       WHERE s.id = ? AND s.clinica_id = ?`,
            [id, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Solicitação não encontrada.' });
        }

        const [itens] = await db.query(
            `SELECT * FROM solicitacao_exame_itens
       WHERE solicitacao_id = ?
       ORDER BY ordem`,
            [id]
        );

        // Auditoria de visualização
        await auditService.registrarLog(usuarioId, 'solicitacao_exame', id, 'VISUALIZOU', {
            crm: rows[0].profissional_crm,
            uf_crm: rows[0].profissional_uf_crm
        });

        res.json({ ...rows[0], itens });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// =========================================================
// 5. CANCELAR SOLICITAÇÃO
// =========================================================
exports.cancelarSolicitacao = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT status_solicitacao, profissional_crm, profissional_uf_crm
       FROM solicitacoes_exames
       WHERE id = ? AND clinica_id = ?`,
            [id, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Solicitação não encontrada.' });
        }

        if (rows[0].status_solicitacao === 'cancelado') {
            return res.status(400).json({ erro: 'Esta solicitação já está cancelada.' });
        }

        await db.query(
            `UPDATE solicitacoes_exames
       SET status_solicitacao = 'cancelado'
       WHERE id = ? AND clinica_id = ?`,
            [id, clinicaId]
        );

        await auditService.registrarLog(usuarioId, 'solicitacao_exame', id, 'CANCELOU', {
            crm: rows[0].profissional_crm,
            uf_crm: rows[0].profissional_uf_crm
        });

        res.json({ success: true, message: 'Solicitação cancelada com sucesso.' });
    } catch (err) {
        console.error('ERRO AO CANCELAR SOLICITAÇÃO:', err);
        res.status(500).json({ erro: 'Erro ao cancelar solicitação.' });
    }
};



// =========================================================
// 6. ENVIAR SOLICITAÇÃO DE EXAMES POR E-MAIL
// =========================================================
exports.enviarExamesEmail = async (req, res) => {
    const { solicitacaoId } = req.body;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT s.*, 
              p.id AS paciente_id_ref,
              p.nome AS nome_paciente, 
              p.email AS email_paciente
       FROM solicitacoes_exames s
       JOIN pacientes p ON s.paciente_id = p.id
       WHERE s.id = ? AND s.clinica_id = ? AND s.status_solicitacao = 'emitido'`,
            [solicitacaoId, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Solicitação emitida não encontrada.' });
        }

        const solicitacao = rows[0];

        if (!solicitacao.email_paciente) {
            return res.status(400).json({ erro: 'Paciente não possui e-mail cadastrado.' });
        }

        const [itens] = await db.query(
            `SELECT * FROM solicitacao_exame_itens WHERE solicitacao_id = ? ORDER BY ordem`,
            [solicitacaoId]
        );

        // 🔑 gera token novo + 24h
        const novoToken = crypto.randomBytes(32).toString('hex');
        const novaExpiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.query(
            'UPDATE pacientes SET token_acesso = ?, token_expiracao = ? WHERE id = ? AND clinica_id = ?',
            [novoToken, novaExpiracao, solicitacao.paciente_id_ref, clinicaId]
        );

        await auditService.registrarLog(usuarioId, 'solicitacao_exame', solicitacaoId, 'ENVIOU_EMAIL', {
            crm: solicitacao.profissional_crm,
            uf_crm: solicitacao.profissional_uf_crm
        });

        await notificationService.sendExamesEmailNotification({
            nome_paciente: solicitacao.nome_paciente,
            email_paciente: solicitacao.email_paciente,
            token_acesso: novoToken, // ✅
            nome_profissional: solicitacao.profissional_nome,
            profissional_crm: solicitacao.profissional_crm,
            profissional_uf_crm: solicitacao.profissional_uf_crm,
            data_emissao: solicitacao.data_emissao
                ? new Date(solicitacao.data_emissao).toLocaleDateString('pt-BR')
                : new Date().toLocaleDateString('pt-BR'),
            titulo: solicitacao.titulo,
            prioridade: solicitacao.prioridade,
            observacoes: solicitacao.observacoes,
            itens
        });

        res.json({ success: true, message: 'Solicitação de exames enviada por e-mail com sucesso!' });
    } catch (error) {
        console.error('ERRO NO ENVIO DE EXAMES:', error);
        res.status(500).json({ erro: 'Falha ao enviar e-mail da solicitação de exames.' });
    }
};