const db = require('../config/db');
const { uploadDocumentoToR2, getUrlDocumentoR2 } = require('../services/documentosService');

exports.validarAcessoPortal = async (req, res) => {
    const { token } = req.query;

    if (!token) return res.status(400).send("Token não fornecido.");

    try {
        const [pacientes] = await db.query(
            'SELECT id, nome, clinica_id FROM pacientes WHERE token_acesso = ? AND token_expiracao > NOW()',
            [token]
        );

        if (pacientes.length === 0) {
            return res.status(401).send("Token inválido ou expirado.");
        }

        const paciente = pacientes[0];

        // Limpa qualquer sessão antiga de outro paciente
        req.session.pacientePortal = null;

        // Grava SOMENTE dados deste token (chave isolada)
        req.session.pacientePortal = {
            id: paciente.id,
            clinicaId: paciente.clinica_id
        };

        req.session.save((err) => {
            if (err) {
                console.error("Erro ao salvar sessão:", err);
                return res.status(500).send("Erro na sessão.");
            }
            res.redirect('/portal_paciente/dashboard');
        });

    } catch (error) {
        console.error("Erro na validação:", error);
        res.status(500).send("Erro interno.");
    }
};

exports.getDadosPortal = async (req, res) => {
    try {
        const sessao = req.session.pacientePortal;

        if (!sessao || !sessao.id) {
            return res.status(401).json({ error: "Sessão inválida. Acesse pelo link do e-mail." });
        }

        const pId = sessao.id;
        const cId = sessao.clinicaId;

        const [paciente] = await db.query(`
            SELECT p.*, c.nome_clinica, c.slug 
            FROM pacientes p 
            JOIN clinicas c ON p.clinica_id = c.id 
            WHERE p.id = ? AND p.clinica_id = ?
        `, [pId, cId]);

        if (!paciente || paciente.length === 0) {
            return res.status(401).json({ error: "Paciente não encontrado." });
        }

        const [config] = await db.query(
            'SELECT * FROM clinica_configuracoes WHERE clinica_id = ?',
            [cId]
        );

        const [agendamentos] = await db.query(
            'SELECT * FROM agendamentos WHERE paciente_id = ? ORDER BY data_agendamento DESC',
            [pId]
        );

        const [prontuarios] = await db.query(
            'SELECT * FROM prontuarios WHERE paciente_id = ? ORDER BY data_atendimento DESC',
            [pId]
        );

        // Documentos do paciente
        const [documentos] = await db.query(
            `SELECT id, nome_original, mime_type, tamanho_bytes, storage_key, criado_em 
             FROM paciente_documentos 
             WHERE paciente_id = ? AND clinica_id = ? 
             ORDER BY criado_em DESC`,
            [pId, cId]
        );

        // Gera URLs assinadas temporárias
        const documentosComUrl = await Promise.all(
            documentos.map(async (doc) => {
                try {
                    const url = await getUrlDocumentoR2(doc.storage_key);
                    return { ...doc, url };
                } catch (err) {
                    console.error("Erro ao gerar URL assinada:", err);
                    return { ...doc, url: null };
                }
            })
        );

        res.json({
            paciente: paciente[0],
            config: config[0] || {},
            agendamentos,
            prontuarios,
            documentos: documentosComUrl
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro ao buscar dados" });
    }
};

/**
 * Upload de exames/documentos pelo paciente
 */
exports.uploadDocumentoPortal = async (req, res) => {
    try {
        const sessao = req.session.pacientePortal;

        if (!sessao || !sessao.id) {
            return res.status(401).json({ error: "Sessão inválida." });
        }

        if (!req.file) {
            return res.status(400).json({ error: "Nenhum arquivo enviado." });
        }

        // Validações básicas de segurança
        const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/jpg'
        ];

        if (!allowedMimes.includes(req.file.mimetype)) {
            return res.status(400).json({
                error: "Tipo de arquivo não permitido. Envie PDF, JPG ou PNG."
            });
        }

        // Limite de 15MB
        if (req.file.size > 15 * 1024 * 1024) {
            return res.status(400).json({ error: "Arquivo muito grande. Máximo 15MB." });
        }

        const pacienteId = sessao.id;
        const clinicaId = sessao.clinicaId;

        // Upload para o R2
        const resultado = await uploadDocumentoToR2(req.file, pacienteId);

        // Salva no banco
        const [insert] = await db.query(
            `INSERT INTO paciente_documentos 
             (clinica_id, paciente_id, nome_original, storage_key, mime_type, tamanho_bytes) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                clinicaId,
                pacienteId,
                resultado.nomeOriginal,
                resultado.storageKey,
                resultado.mimetype,
                resultado.tamanho
            ]
        );

        const { criarNotificacao } = require('../services/notificationService');

        // Busca o nome do paciente para a mensagem
        const [pac] = await db.query('SELECT nome FROM pacientes WHERE id = ?', [paciente_Id]);
        const nomePaciente = pac[0]?.nome || 'Paciente';

        await criarNotificacao({
            clinicaId,
            tipo: 'documento',
            titulo: 'Novo documento enviado',
            mensagem: `${nomePaciente} enviou o arquivo "${resultado.nomeOriginal}"`,
            referenciaId: insert.insertId,
            paciente_Id
        });

        // Gera URL assinada para retornar já utilizável
        const urlAssinada = await getUrlDocumentoR2(resultado.storageKey);

        res.status(201).json({
            success: true,
            message: "Documento enviado com sucesso!",
            documento: {
                id: insert.insertId,
                nome_original: resultado.nomeOriginal,
                mime_type: resultado.mimetype,
                tamanho_bytes: resultado.tamanho,
                storage_key: resultado.storageKey,
                url: urlAssinada,
                criado_em: new Date()
            }
        });

    } catch (error) {
        console.error("Erro no upload do portal:", error);
        res.status(500).json({ error: "Erro ao enviar documento." });
    }
};