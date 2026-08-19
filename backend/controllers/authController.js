require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

exports.login = async (req, res) => {
    const { email, senha } = req.body;

    try {
        const [usuarios] = await db.execute(
            `SELECT u.*, c.nome_clinica AS clinica_nome, c.status AS clinica_status, c.data_expiracao, p.nome_plano
                FROM usuarios u
                LEFT JOIN clinicas c ON u.clinica_id = c.id
                LEFT JOIN planos p ON c.plano_id = p.id
                WHERE u.email = ?`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: "E-mail ou senha inválidos." });
        }

        const usuario = usuarios[0];

        // ⚠️ TODO SEGURANÇA: migrar para bcrypt
        if (senha !== usuario.senha) {
            return res.status(401).json({ error: "E-mail ou senha inválidos." });
        }

        if (usuario.email !== 'medlm.com' && usuario.clinica_status === 'suspenso') {
            return res.status(403).json({
                error: "O acesso desta clínica foi suspenso. Entre em contato com o suporte."
            });
        }

        const sessaoId = crypto.randomUUID();
        await db.execute(
            'UPDATE usuarios SET current_session_token = ? WHERE id = ?',
            [sessaoId, usuario.id]
        );

        const token = jwt.sign(
            {
                id: usuario.id,
                clinica_id: usuario.clinica_id,
                cargo: usuario.cargo,
                email: usuario.email,
                nome: usuario.nome,
                nome_clinica: usuario.clinica_nome,
                crm: usuario.crm || null,
                uf_crm: usuario.uf_crm || null,
                sid: sessaoId
            },
            process.env.JWT_SECRET || 'seu_segredo_aqui',
            { expiresIn: '8h' }
        );

        let redirectUrl = '/dashboard';
        if (usuario.email === 'admin@medlm.com' && usuario.cargo === 'dono') {
            redirectUrl = '/admin';
        }

        return res.json({
            success: true,
            message: "Bem-vindo ao MedLM!",
            token: token,
            redirectUrl: redirectUrl,
            usuarioNome: usuario.nome,
            clinicaNome: usuario.clinica_nome || 'MedLM Admin',
            cargo: usuario.cargo,
            crm: usuario.crm || null,
            uf_crm: usuario.uf_crm || null
        });

    } catch (error) {
        console.error("Erro no Login:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};