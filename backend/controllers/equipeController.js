const db = require('../config/db');

// Exportamos a função para o Routes conseguir ler
exports.adicionarMembro = async (req, res) => {
    const { nome, email, senha, cargo } = req.body;
    const clinicaId = 1; // Temporário até o JWT entrar

    try {
        // 1. VERIFICAÇÃO DE E-MAIL DUPLICADO
        const [existeEmail] = await db.execute(
            "SELECT id FROM membros_equipe WHERE email = ?",
            [email]
        );

        if (existeEmail.length > 0) {
            return res.status(400).json({ error: "Este e-mail já está sendo usado." });
        }

        // 2. CHECAGEM DE LIMITE
        const [clinica] = await db.execute("SELECT limite_membros FROM clinicas WHERE id = ?", [clinicaId]);
        const [membrosAtuais] = await db.execute("SELECT COUNT(*) as total FROM membros_equipe WHERE clinica_id = ?", [clinicaId]);

        if (clinica.length === 0) {
            return res.status(404).json({ error: "Clínica não encontrada." });
        }

        if (membrosAtuais[0].total >= clinica[0].limite_membros) {
            return res.status(403).json({ error: "Limite de membros atingido. Faça upgrade!" });
        }

        // 3. SALVAR
        const sql = "INSERT INTO membros_equipe (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)";
        await db.execute(sql, [clinicaId, nome, email, senha, cargo]);

        res.json({ message: "Membro adicionado com sucesso!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};