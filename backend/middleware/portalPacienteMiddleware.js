const db = require('../config/db'); // Certifique-se que o caminho está correto

exports.verificarAcessoPortal = async (req, res, next) => {
    // 1. Verifica se a sessão do paciente existe
    if (req.session && req.session.pacienteId) {
        try {
            // 2. Busca os dados básicos do paciente no banco para confirmar que ele ainda existe
            const [pacientes] = await db.query(
                'SELECT id, nome, clinica_id FROM pacientes WHERE id = ?',
                [req.session.pacienteId]
            );

            if (pacientes.length > 0) {
                // 3. Injeta os dados do paciente no objeto req para usar no controller do dashboard
                req.paciente = pacientes[0];
                return next(); // Acesso liberado!
            }
        } catch (error) {
            console.error("Erro ao verificar sessão do portal:", error);
            return res.status(500).send("Erro interno ao validar sessão.");
        }
    }

    // 4. Se não estiver logado ou o token/sessão for inválido, bloqueia
    return res.status(401).send("Acesso negado. Por favor, utilize o link enviado ao seu e-mail.");
};