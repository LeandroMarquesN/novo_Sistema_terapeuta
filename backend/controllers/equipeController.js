const db = require('../config/db');

// --- FUNÇÃO PARA ADICIONAR MEMBRO ---
exports.adicionarMembro = async (req, res) => {
    const { nome, email, senha, cargo } = req.body;

    // USANDO 'req.usuario' PARA BATER COM O SEU MIDDLEWARE!
    const clinicaId = req.usuario.clinica_id;

    try {
        const [existeEmail] = await db.execute("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (existeEmail.length > 0) {
            return res.status(400).json({ error: "Este e-mail já está em uso." });
        }

        const [clinicaRows] = await db.execute("SELECT limite_membros FROM clinicas WHERE id = ?", [clinicaId]);
        const [countRows] = await db.execute("SELECT COUNT(*) as total FROM usuarios WHERE clinica_id = ?", [clinicaId]);

        if (countRows[0].total >= clinicaRows[0].limite_membros) {
            return res.status(403).json({ error: "Limite de membros atingido para o seu plano!" });
        }

        const cargoFormatado = cargo.toLowerCase();
        await db.execute(
            "INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)",
            [clinicaId, nome, email, senha, cargoFormatado]
        );

        res.json({ message: "Membro adicionado com sucesso!" });
    } catch (err) {
        console.error("Erro ao adicionar membro:", err);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};

// --- FUNÇÃO PARA LISTAR MEMBROS ---
exports.listarMembros = async (req, res) => {
    try {
        // AQUI TAMBÉM: Mudamos para 'req.usuario'
        const clinicaId = req.usuario.clinica_id;

        const [membros] = await db.execute(
            "SELECT id, nome, email, cargo FROM usuarios WHERE clinica_id = ?",
            [clinicaId]
        );

        res.json(membros);
    } catch (error) {
        console.error("Erro ao listar equipe:", error);
        res.status(500).json({ error: "Erro ao buscar dados da equipe." });
    }
};