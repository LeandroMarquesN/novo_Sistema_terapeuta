const db = require('../config/db');

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
        // Lê da chave isolada
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

        res.json({
            paciente: paciente[0],
            config: config[0] || {},
            agendamentos,
            prontuarios
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro ao buscar dados" });
    }
};