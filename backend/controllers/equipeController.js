const db = require('../config/db');

// Cargos da área de saúde que exigem CRM / registro profissional
const CARGOS_SAUDE = [
    'medico',
    'psicologo',
    'fisioterapeuta',
    'nutricionista',
    'fonoaudiologo',
    'profissional da saude',
    'terapeuta'
];

// --- FUNÇÃO PARA ADICIONAR MEMBRO ---
exports.adicionarMembro = async (req, res) => {
    const { nome, email, senha, cargo, crm, uf_crm } = req.body;
    const clinicaId = req.usuario.clinica_id;

    try {
        // 1. Verificar se o e-mail já existe
        const [existeEmail] = await db.execute("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (existeEmail.length > 0) {
            return res.status(400).json({ error: "Este e-mail já está em uso." });
        }

        // 2. BUSCA O LIMITE DO PLANO
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
        const [countRows] = await db.execute(
            "SELECT COUNT(*) as total FROM usuarios WHERE clinica_id = ?",
            [clinicaId]
        );
        const totalAtual = countRows[0].total;

        // 4. Validação de Limite
        if (totalAtual >= limitePermitido) {
            return res.status(403).json({
                error: `Limite de membros atingido! Seu plano permite apenas ${limitePermitido} usuários.`
            });
        }

        // 5. Normalização e validação de CRM / UF
        const cargoFormatado = (cargo || '').toLowerCase().trim();
        const crmLimpo = crm ? String(crm).trim() : null;
        const ufLimpa = uf_crm ? String(uf_crm).trim().toUpperCase() : null;

        const ehCargoSaude = CARGOS_SAUDE.includes(cargoFormatado);

        if (ehCargoSaude) {
            if (!crmLimpo || !ufLimpa) {
                return res.status(400).json({
                    error: "Para cargos da área de saúde é obrigatório informar o CRM e a UF do CRM."
                });
            }
            if (ufLimpa.length !== 2) {
                return res.status(400).json({ error: "UF do CRM inválida." });
            }
        }

        // 6. Inserção do novo membro (com CRM e UF)
        await db.execute(
            `INSERT INTO usuarios 
                (clinica_id, nome, email, senha, cargo, crm, uf_crm) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [clinicaId, nome, email, senha, cargoFormatado, crmLimpo, ufLimpa]
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
            `SELECT id, nome, email, cargo, crm, uf_crm 
             FROM usuarios 
             WHERE clinica_id = ?`,
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
    const clinicaId = req.usuario.clinica_id;

    try {
        const [planoInfo] = await db.execute(`
            SELECT p.nome_plano, p.limite_membros
            FROM clinicas c
            INNER JOIN planos p ON c.plano_id = p.id
            WHERE c.id = ?
        `, [clinicaId]);

        if (planoInfo.length === 0) {
            return res.status(404).json({ error: "Plano ou clínica não encontrados." });
        }

        const [countRows] = await db.execute(
            "SELECT COUNT(*) as total FROM usuarios WHERE clinica_id = ?",
            [clinicaId]
        );

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

// --- FUNÇÃO PARA REMOVER MEMBRO ---
exports.removerMembro = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;
    const usuarioLogadoId = req.usuario.id;

    try {
        const [membros] = await db.execute(
            "SELECT id, nome, cargo FROM usuarios WHERE id = ? AND clinica_id = ?",
            [id, clinicaId]
        );

        if (membros.length === 0) {
            return res.status(404).json({ error: "Profissional não encontrado nesta clínica." });
        }

        const membro = membros[0];

        if (Number(id) === Number(usuarioLogadoId)) {
            return res.status(400).json({ error: "Você não pode remover a si mesmo." });
        }

        if (membro.cargo === 'dono') {
            return res.status(403).json({ error: "Não é possível remover o dono da clínica." });
        }

        await db.execute(
            "DELETE FROM usuarios WHERE id = ? AND clinica_id = ?",
            [id, clinicaId]
        );

        console.log(`Log: Usuário ${membro.nome} (ID: ${id}) foi removido da equipe da clínica ${clinicaId} por ${req.usuario.nome} (ID: ${usuarioLogadoId}).`);

        res.json({ message: "Profissional removido com sucesso." });

    } catch (err) {
        console.error("Erro ao remover membro:", err);
        res.status(500).json({ error: "Erro interno ao remover profissional." });
    }
};