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
        const cId = req.session.clinicaId; // Já carregamos isso na sessão no login

        // 1. Dados do Paciente + Clínica
        const [paciente] = await db.query(`
            SELECT p.*, c.nome_clinica 
            FROM pacientes p 
            JOIN clinicas c ON p.clinica_id = c.id 
            WHERE p.id = ?`, [pId]);

        // 2. Configurações da Clínica
        const [config] = await db.query('SELECT * FROM clinica_configuracoes WHERE clinica_id = ?', [cId]);

        // 3. Agendamentos e Prontuários
        const [agendamentos] = await db.query('SELECT * FROM agendamentos WHERE paciente_id = ? ORDER BY data_agendamento DESC', [pId]);
        const [prontuarios] = await db.query('SELECT * FROM prontuarios WHERE paciente_id = ? ORDER BY data_atendimento DESC', [pId]);

        res.json({
            paciente: paciente[0],
            config: config[0],
            agendamentos,
            prontuarios
        });
    } catch (e) { res.status(500).json({ error: "Erro ao buscar dados" }); }
};