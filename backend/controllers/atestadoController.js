/**
 * MedLM - Controller de Atestados Médicos
 * Conformidade jurídica: autoria da sessão + snapshot CRM/UF + trilha de auditoria + imutabilidade
 */
const db = require('../config/db');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

// =========================================================
// 1. SALVAR / EMITIR ATESTADO
// =========================================================
exports.salvarAtestado = async (req, res) => {
    const {
        pacienteId,
        agendamentoId,
        prontuarioId,
        tipoAtestado = 'afastamento',
        diasAfastamento,
        dataInicio,
        dataFim,
        cid,
        textoLivre,
        localAtendimento,
        senhaAssinatura,
        apenasRascunho = false
    } = req.body;

    const usuarioId = req.usuario?.id;
    const clinicaId = req.usuario?.clinica_id;

    if (!pacienteId) {
        return res.status(400).json({ erro: 'Paciente é obrigatório.' });
    }

    // Validações básicas por tipo
    if (tipoAtestado === 'afastamento' && !apenasRascunho) {
        if (!diasAfastamento || diasAfastamento < 1) {
            return res.status(400).json({ erro: 'Informe a quantidade de dias de afastamento.' });
        }
    }

    if (!apenasRascunho && !senhaAssinatura) {
        return res.status(400).json({ erro: 'Senha de assinatura é obrigatória para emitir o atestado.' });
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

        // 3. Insere o atestado
        const [result] = await conn.query(
            `INSERT INTO atestados
       (clinica_id, paciente_id, usuario_id, agendamento_id, prontuario_id,
        profissional_nome, profissional_crm, profissional_uf_crm,
        tipo_atestado, dias_afastamento, data_inicio, data_fim,
        cid, texto_livre, local_atendimento,
        status_atestado, data_emissao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                clinicaId,
                pacienteId,
                usuarioId,
                agendamentoId || null,
                prontuarioId || null,
                profissional.nome,
                profissional.crm,
                profissional.uf_crm,
                tipoAtestado,
                diasAfastamento || null,
                dataInicio || null,
                dataFim || null,
                cid || null,
                textoLivre || null,
                localAtendimento || null,
                status,
                dataEmissao
            ]
        );

        const atestadoId = result.insertId;

        await conn.commit();

        // 4. Auditoria
        await auditService.registrarLog(
            usuarioId,
            'atestado',
            atestadoId,
            apenasRascunho ? 'CRIOU_RASCUNHO' : 'EMITIU_COM_SENHA',
            {
                crm: profissional.crm,
                uf_crm: profissional.uf_crm,
                prontuarioId
            }
        );

        res.status(201).json({
            success: true,
            atestadoId,
            status,
            message: apenasRascunho
                ? 'Rascunho de atestado salvo com sucesso.'
                : 'Atestado emitido e assinado com sucesso.'
        });

    } catch (error) {
        await conn.rollback();
        console.error('ERRO AO SALVAR ATESTADO:', error);
        res.status(500).json({ erro: 'Erro crítico ao persistir atestado.' });
    } finally {
        conn.release();
    }
};

// =========================================================
// 2. LISTAR ATESTADOS DO PACIENTE
// =========================================================
exports.listarAtestados = async (req, res) => {
    const { pacienteId } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        const [rows] = await db.query(
            `SELECT 
         id,
         tipo_atestado,
         dias_afastamento,
         data_inicio,
         data_fim,
         cid,
         status_atestado,
         data_emissao,
         criado_em,
         profissional_nome,
         profissional_crm,
         profissional_uf_crm
       FROM atestados
       WHERE paciente_id = ? AND clinica_id = ?
       ORDER BY criado_em DESC`,
            [pacienteId, clinicaId]
        );

        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// =========================================================
// 3. DETALHE COMPLETO DO ATESTADO
// =========================================================
exports.obterDetalheAtestado = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT a.*,
              p.nome AS nome_paciente,
              p.cpf AS cpf_paciente,
              p.data_nascimento
       FROM atestados a
       JOIN pacientes p ON a.paciente_id = p.id
       WHERE a.id = ? AND a.clinica_id = ?`,
            [id, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Atestado não encontrado.' });
        }

        // Auditoria de visualização
        await auditService.registrarLog(usuarioId, 'atestado', id, 'VISUALIZOU', {
            crm: rows[0].profissional_crm,
            uf_crm: rows[0].profissional_uf_crm
        });

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// =========================================================
// 4. CANCELAR ATESTADO (somente se ainda estiver emitido)
// =========================================================
exports.cancelarAtestado = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT status_atestado, profissional_crm, profissional_uf_crm
       FROM atestados
       WHERE id = ? AND clinica_id = ?`,
            [id, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Atestado não encontrado.' });
        }

        if (rows[0].status_atestado === 'cancelado') {
            return res.status(400).json({ erro: 'Este atestado já está cancelado.' });
        }

        await db.query(
            `UPDATE atestados 
       SET status_atestado = 'cancelado' 
       WHERE id = ? AND clinica_id = ?`,
            [id, clinicaId]
        );

        await auditService.registrarLog(usuarioId, 'atestado', id, 'CANCELOU', {
            crm: rows[0].profissional_crm,
            uf_crm: rows[0].profissional_uf_crm
        });

        res.json({ success: true, message: 'Atestado cancelado com sucesso.' });
    } catch (err) {
        console.error('ERRO AO CANCELAR ATESTADO:', err);
        res.status(500).json({ erro: 'Erro ao cancelar atestado.' });
    }
};



// =========================================================
// 5. ENVIAR ATESTADO POR E-MAIL
// =========================================================
exports.enviarAtestadoEmail = async (req, res) => {
    const { atestadoId } = req.body;
    const clinicaId = req.usuario.clinica_id;
    const usuarioId = req.usuario.id;

    try {
        const [rows] = await db.query(
            `SELECT a.*, 
              p.nome AS nome_paciente, 
              p.email AS email_paciente, 
              p.token_acesso
       FROM atestados a
       JOIN pacientes p ON a.paciente_id = p.id
       WHERE a.id = ? AND a.clinica_id = ? AND a.status_atestado = 'emitido'`,
            [atestadoId, clinicaId]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Atestado emitido não encontrado.' });
        }

        const atestado = rows[0];

        if (!atestado.email_paciente) {
            return res.status(400).json({ erro: 'Paciente não possui e-mail cadastrado.' });
        }

        await auditService.registrarLog(usuarioId, 'atestado', atestadoId, 'ENVIOU_EMAIL', {
            crm: atestado.profissional_crm,
            uf_crm: atestado.profissional_uf_crm
        });

        await notificationService.sendAtestadoEmailNotification({
            nome_paciente: atestado.nome_paciente,
            email_paciente: atestado.email_paciente,
            token_acesso: atestado.token_acesso,
            nome_profissional: atestado.profissional_nome,
            profissional_crm: atestado.profissional_crm,
            profissional_uf_crm: atestado.profissional_uf_crm,
            tipo_atestado: atestado.tipo_atestado,
            data_emissao: atestado.data_emissao
                ? new Date(atestado.data_emissao).toLocaleDateString('pt-BR')
                : new Date().toLocaleDateString('pt-BR'),
            dias_afastamento: atestado.dias_afastamento,
            data_inicio: atestado.data_inicio,
            data_fim: atestado.data_fim,
            cid: atestado.cid,
            local_atendimento: atestado.local_atendimento,
            texto_livre: atestado.texto_livre
        });

        res.json({ success: true, message: 'Atestado enviado por e-mail com sucesso!' });
    } catch (error) {
        console.error('ERRO NO ENVIO DE ATESTADO:', error);
        res.status(500).json({ erro: 'Falha ao enviar e-mail do atestado.' });
    }
};