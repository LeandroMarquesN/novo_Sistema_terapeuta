// middlewares/portalMiddleware.js
const db = require('../config/db');

module.exports = async (req, res, next) => {
    // 1. TENTATIVA DE ACESSO POR SLUG (Portal de Agendamento)
    // Verifica se existe um parâmetro slug na URL (ex: /agendar/:slug)
    const slug = req.params.slug;

    if (slug) {
        try {
            const [clinicas] = await db.execute('SELECT id FROM clinicas WHERE slug = ?', [slug]);
            if (clinicas.length > 0) {
                // Se achou a clínica, injetamos o ID no objeto request para o controller usar
                req.clinicaId = clinicas[0].id;
                return next(); // Permite o acesso sem estar logado
            }
        } catch (err) {
            console.error("Erro ao validar slug:", err);
        }
    }

    // 2. TENTATIVA DE ACESSO POR SESSÃO (Portal do Paciente Logado)
    if (req.session && req.session.pacienteId) {
        return next(); // Permite o acesso pois está logado
    }

    // 3. SE NEM UM, NEM OUTRO: Bloqueia
    return res.status(401).json({ error: "Portal não identificado. Sessão inválida." });
};