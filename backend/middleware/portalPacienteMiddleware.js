const db = require('../config/db');

module.exports = async (req, res, next) => {
    // 1. Acesso por slug (portal de agendamento público)
    const slug = req.params.slug;
    if (slug) {
        try {
            const [clinicas] = await db.execute('SELECT id FROM clinicas WHERE slug = ?', [slug]);
            if (clinicas.length > 0) {
                req.clinicaId = clinicas[0].id;
                return next();
            }
        } catch (err) {
            console.error("Erro ao validar slug:", err);
        }
    }

    // 2. Acesso pelo portal do paciente (chave isolada)
    if (req.session && req.session.pacientePortal && req.session.pacientePortal.id) {
        return next();
    }

    // 3. Bloqueia
    return res.status(401).json({ error: "Portal não identificado. Sessão inválida." });
};