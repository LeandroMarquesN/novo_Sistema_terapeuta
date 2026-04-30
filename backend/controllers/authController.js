require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcryptjs'); // Mantido para não quebrar o import, mas não usado no compare agora
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { email, senha } = req.body;

    try {
        // 1. Busca o usuário (Note o LEFT JOIN para permitir que o ADMIN logue mesmo sem clínica)
        const [usuarios] = await db.execute(
            `SELECT u.*, c.status AS clinica_status, c.data_expiracao, p.nome_plano
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

        // 2. Verificação de senha (Texto Puro)
        if (senha !== usuario.senha) {
            return res.status(401).json({ error: "E-mail ou senha inválidos." });
        }

        // 3. Trava de Segurança para Clínicas (Pula se for o seu e-mail master)
        if (usuario.email !== 'medlm.com' && usuario.clinica_status === 'suspenso') {
            return res.status(403).json({
                error: "O acesso desta clínica foi suspenso. Entre em contato com o suporte."
            });
        }

        // 4. Geração do Token JWT (DEVE vir antes do redirecionamento!)
        const token = jwt.sign(
            {
                id: usuario.id,
                clinica_id: usuario.clinica_id,
                cargo: usuario.cargo,
                email: usuario.email
            },
            process.env.JWT_SECRET || 'seu_segredo_aqui',
            { expiresIn: '8h' }
        );

        // 5. Lógica de Redirecionamento Inteligente
        // Definimos para onde ele vai, mas só enviamos a resposta no final
        let redirectUrl = '/dashboard';

        if (usuario.email === 'admin@medlm.com' && usuario.cargo === 'dono') {
            redirectUrl = '/admin';
        }

        // 6. Resposta Final Única
        return res.json({
            success: true,
            message: "Bem-vindo ao MedLM!",
            token: token,
            redirectUrl: redirectUrl,
            usuario: {
                nome: usuario.nome,
                cargo: usuario.cargo
            }
        });

    } catch (error) {
        console.error("Erro no Login:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};
