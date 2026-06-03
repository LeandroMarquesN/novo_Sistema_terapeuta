const db = require('../config/db');

// --- FUNÇÃO PARA ADICIONAR MEMBRO ---
exports.adicionarMembro = async (req, res) => {
    const { nome, email, senha, cargo } = req.body;
    const clinicaId = req.usuario.clinica_id;

    try {
        // 1. Verificar se o e-mail já existe
        const [existeEmail] = await db.execute("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (existeEmail.length > 0) {
            return res.status(400).json({ error: "Este e-mail já está em uso." });
        }

        // 2. BUSCA O LIMITE DO PLANO (AQUI ESTÁ A MÁGICA)
        // Fazemos um JOIN entre clinicas e planos para pegar o limite_membros do plano daquela clínica
        const [clinicaPlanos] = await db.execute(`
            SELECT p.limite_membros
            FROM clinicas c
            INNER JOIN planos p ON c.plano_id = p.id
            WHERE c.id = ?
        `, [clinicaId]);

        if (clinicaPlanos.length === 0) {
            return res.status(404).json({ error: "Plano da clínica não encontrado." });
        }

        const limitePermitido = clinicaPlanos[0].limite_membros;

        // 3. Conta quantos membros a clínica já possui
        const [countRows] = await db.execute("SELECT COUNT(*) as total FROM usuarios WHERE clinica_id = ?", [clinicaId]);
        const totalAtual = countRows[0].total;

        // 4. Validação de Limite
        if (totalAtual >= limitePermitido) {
            return res.status(403).json({
                error: `Limite de membros atingido! Seu plano permite apenas ${limitePermitido} usuários.`
            });
        }

        // 5. Inserção do novo membro
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
// --- FUNÇÃO PARA PEGAR STATUS DO PLANO E MEMBROS ---
exports.obterStatusPlano = async (req, res) => {
    // Usando o clinica_id que vem do seu middleware de autenticação
    const clinicaId = req.usuario.clinica_id;

    try {
        // 1. Busca o nome do plano e o limite de membros fazendo JOIN com a tabela planos
        const [planoInfo] = await db.execute(`
            SELECT p.nome_plano, p.limite_membros
            FROM clinicas c
            INNER JOIN planos p ON c.plano_id = p.id
            WHERE c.id = ?
        `, [clinicaId]);

        if (planoInfo.length === 0) {
            return res.status(404).json({ error: "Plano ou clínica não encontrados." });
        }

        // 2. Conta quantos membros (usuários) já estão cadastrados para esta clínica
        const [countRows] = await db.execute(
            "SELECT COUNT(*) as total FROM usuarios WHERE clinica_id = ?",
            [clinicaId]
        );

        // 3. Retorna o JSON que o seu HTML (fetch) está esperando
        res.json({
            plano: planoInfo[0].nome_plano,
            limite: planoInfo[0].limite_membros,
            usado: countRows[0].total,
            restante: planoInfo[0].limite_membros - countRows[0].total
        });

    } catch (err) {
        console.error("Erro ao obter status do plano:", err);
        res.status(500).json({ error: "Erro interno ao buscar informações do plano." });
    }
};