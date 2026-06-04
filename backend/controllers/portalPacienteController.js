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

        // 1. Armazena na sessão
        req.session.pacienteId = paciente.id;
        req.session.clinicaId = paciente.clinica_id;

        // 2. Salva a sessão explicitamente antes de redirecionar
        req.session.save((err) => {
            if (err) {
                console.error("Erro ao salvar sessão:", err);
                return res.status(500).send("Erro na sessão.");
            }
            // 3. Redirecionamento em vez de res.send
            res.redirect('/portal_paciente/dashboard');
        });

    } catch (error) {
        console.error("Erro na validação:", error);
        res.status(500).send("Erro interno.");
    }
};

exports.getDadosPortal = async (req, res) => {
    try {
        const pId = req.session.pacienteId;

        // Verificação crítica: se não houver ID na sessão, barra o acesso
        if (!pId) {
            return res.status(401).json({ error: "Sessão expirada ou não autenticada." });
        }

        const [paciente] = await db.query('SELECT * FROM pacientes WHERE id = ?', [pId]);
        const [agendamentos] = await db.query('SELECT * FROM agendamentos WHERE paciente_id = ? ORDER BY data_agendamento ASC', [pId]);

        // Verificação se o paciente existe
        if (!paciente || paciente.length === 0) {
            return res.status(404).json({ error: "Paciente não encontrado." });
        }

        res.json({ paciente: paciente[0], agendamentos });
    } catch (e) {
        console.error("ERRO NO GET DADOS:", e);
        res.status(500).json({ error: "Erro crítico no banco de dados." });
    }
};