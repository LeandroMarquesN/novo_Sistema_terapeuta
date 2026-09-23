/**
 * MedLM - Controller de Receituário Digital
 * Conformidade: autoria da sessão + snapshot CRM/UF + trilha de auditoria + imutabilidade
 */
const db = require('../config/db');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const crypto = require('crypto');

// =========================================================
// 1. SALVAR / EMITIR RECEITA (com itens)
// =========================================================
exports.salvarReceita = async (req, res) => {
    const {
        pacienteId,
        agendamentoId,
        prontuarioId,
        observacoes,
        validadeDias,
        itens,               // array de medicamentos
        senhaAssinatura,     // obrigatória para emitir
        apenasRascunho = false
    } = req.body;

    const usuarioId = req.usuario?.id;
    const clinicaId = req.usuario?.clinica_id;

    if (!pacienteId || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ erro: 'Paciente e pelo menos um medicamento são obrigatórios.' });
    }

    if (!apenasRascunho && !senhaAssinatura) {
        return res.status(400).json({ erro: 'Senha de assinatura é obrigatória para emitir a receita.' });
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

        // 3. Insere cabeçalho da receita
        const [result] = await conn.query(
            `INSERT INTO receitas
       (clinica_id, paciente_id, usuario_id, agendamento_id, prontuario_id,
        profissional_nome, profissional_crm, profissional_uf_crm,
        observacoes, validade_dias, status_receita, data_emissao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                clinicaId,
                pacienteId,
                usuarioId,
                agendamentoId || null,
                prontuarioId || null,
                profissional.nome,
                profissional.crm,
                profissional.uf_crm,
                observacoes || null,
                validadeDias || 30,
                status,
                dataEmissao
            ]
        );

        const receitaId = result.insertId;

        // 4. Insere itens
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            await conn.query(
                `INSERT INTO receita_itens
         (receita_id, ordem, medicamento_nome, concentracao, forma_farmaceutica,
          quantidade, posologia, via_administracao, uso_continuo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    receitaId,
                    i + 1,
                    item.medicamento_nome,
                    item.concentracao || null,
                    item.forma_farmaceutica || null,
                    item.quantidade,
                    item.posologia,
                    item.via_administracao || null,
                    item.uso_continuo ? 1 : 0
                ]
            );
        }

        await conn.commit();

        // 5. Auditoria
        await auditService.registrarLog(
            usuarioId,
            'receita',
            receitaId,
            apenasRascunho ? 'CRIOU_RASCUNHO' : 'EMITIU_COM_SENHA',
            { crm: profissional.crm, uf_crm: profissional.uf_crm, prontuarioId }
        );

        res.status(201).json({
            success: true,
            receitaId,
            status,
            message: apenasRascunho ? 'Rascunho salvo com sucesso.' : 'Receita emitida e assinada com sucesso.'
        });

    } catch (error) {
        await conn.rollback();
        console.error('ERRO AO SALVAR RECEITA:', error);
        res.status(500).json({ erro: 'Erro crítico ao persistir receita.' });
    } finally {
        conn.release();
    }
};

// =========================================================
// 2. LISTAR RECEITAS DO PACIENTE
// =========================================================
exports.listarReceitas = async (req, res) => {
    const { pacienteId } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        const [rows] = await db.query(
            `SELECT r.id, r.status_receita, r.data_emissao, r.criado_em,
              r.profissional_nome, r.profissional_crm, r.profissional_uf_crm,
              r.validade_dias,
              (SELECT COUNT(*) FROM receita_itens WHERE receita_id = r.id) AS total_itens
       FROM receitas r
       WHERE r.paciente_id = ? AND r.clinica_id = ?
       ORDER BY r.criado_em DESC`,
            [pacienteId, clinicaId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// =========================================================
// 3. DETALHE COMPLETO DA RECEITA (com itens)
// =========================================================
exports.obterDetalheReceita = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT r.*, p.nome AS nome_paciente, p.cpf AS cpf_paciente
       FROM receitas r
       JOIN pacientes p ON r.paciente_id = p.id
       WHERE r.id = ? AND r.clinica_id = ?`,
            [id, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Receita não encontrada.' });
        }

        const [itens] = await db.query(
            `SELECT * FROM receita_itens WHERE receita_id = ? ORDER BY ordem`,
            [id]
        );

        // Auditoria de visualização
        await auditService.registrarLog(usuarioId, 'receita', id, 'VISUALIZOU', {
            crm: rows[0].profissional_crm,
            uf_crm: rows[0].profissional_uf_crm
        });

        res.json({ ...rows[0], itens });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// =========================================================
// 4. ENVIAR RECEITA POR E-MAIL
// =========================================================
exports.enviarReceitaEmail = async (req, res) => {
    const { receitaId } = req.body;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT r.*, 
              p.nome AS nome_paciente, p.email AS email_paciente, p.token_acesso,
              c.nome_clinica
       FROM receitas r
       JOIN pacientes p ON r.paciente_id = p.id
       JOIN clinicas c ON r.clinica_id = c.id
       WHERE r.id = ? AND r.clinica_id = ? AND r.status_receita = 'emitido'`,
            [receitaId, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Receita emitida não encontrada.' });
        }

        const [itens] = await db.query(
            `SELECT * FROM receita_itens WHERE receita_id = ? ORDER BY ordem`,
            [receitaId]
        );

        const receita = rows[0];

        // Aqui você pode montar o HTML ou chamar um template específico
        // Por enquanto deixamos preparado para o notificationService
        await auditService.registrarLog(usuarioId, 'receita', receitaId, 'ENVIOU_EMAIL');

        // TODO: implementar template de e-mail de receita no notificationService
        // await notificationService.sendReceitaEmailNotification({ ... });

        res.json({ success: true, message: 'Receita enviada por e-mail com sucesso!' });
    } catch (error) {
        console.error('ERRO NO ENVIO DE RECEITA:', error);
        res.status(500).json({ erro: 'Falha ao enviar e-mail da receita.' });
    }
};
// =========================================================
// 4. ENVIAR RECEITA POR E-MAIL
// =========================================================
exports.enviarReceitaEmail = async (req, res) => {
    const { receitaId } = req.body;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT r.*, 
                p.id AS paciente_id_ref,
                p.nome AS nome_paciente, 
                p.email AS email_paciente
         FROM receitas r
         JOIN pacientes p ON r.paciente_id = p.id
         WHERE r.id = ? AND r.clinica_id = ? AND r.status_receita = 'emitido'`,
            [receitaId, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Receita emitida não encontrada.' });
        }

        const receita = rows[0];

        if (!receita.email_paciente) {
            return res.status(400).json({ erro: 'Paciente não possui e-mail cadastrado.' });
        }

        const [itens] = await db.query(
            `SELECT * FROM receita_itens WHERE receita_id = ? ORDER BY ordem`,
            [receitaId]
        );

        // 🔑 gera token novo + 24h
        const novoToken = crypto.randomBytes(32).toString('hex');
        const novaExpiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.query(
            'UPDATE pacientes SET token_acesso = ?, token_expiracao = ? WHERE id = ? AND clinica_id = ?',
            [novoToken, novaExpiracao, receita.paciente_id_ref, clinicaId]
        );

        await auditService.registrarLog(usuarioId, 'receita', receitaId, 'ENVIOU_EMAIL', {
            crm: receita.profissional_crm,
            uf_crm: receita.profissional_uf_crm
        });

        await notificationService.sendReceitaEmailNotification({
            nome_paciente: receita.nome_paciente,
            email_paciente: receita.email_paciente,
            token_acesso: novoToken, // ✅
            nome_profissional: receita.profissional_nome,
            profissional_crm: receita.profissional_crm,
            profissional_uf_crm: receita.profissional_uf_crm,
            data_emissao: receita.data_emissao
                ? new Date(receita.data_emissao).toLocaleDateString('pt-BR')
                : new Date().toLocaleDateString('pt-BR'),
            validade_dias: receita.validade_dias || 30,
            observacoes: receita.observacoes,
            itens
        });

        res.json({ success: true, message: 'Receita enviada por e-mail com sucesso!' });
    } catch (error) {
        console.error('ERRO NO ENVIO DE RECEITA:', error);
        res.status(500).json({ erro: 'Falha ao enviar e-mail da receita.' });
    }
};