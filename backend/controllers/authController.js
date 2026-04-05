require('dotenv').config(); // Adicione isso aqui no topo
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { email, senha } = req.body;

    try {
        // 1. Busca o usuário e os dados da clínica dele (Join)
        const [usuarios] = await db.execute(
            `SELECT u.*, c.nome_clinica 
             FROM usuarios u 
             JOIN clinicas c ON u.clinica_id = c.id 
             WHERE u.email = ?`,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ error: "E-mail ou senha inválidos." });
        }

        const usuario = usuarios[0];

        // 2. Comparação de senha (Por enquanto texto puro, depois usaremos bcrypt.compare)
        if (senha !== usuario.senha) {
            return res.status(401).json({ error: "E-mail ou senha inválidos." });
        }

        // Teste rápido: se quiser ter certeza absoluta, coloque um console log temporário:
        console.log("Minha chave secreta é:", process.env.JWT_SECRET);

        // 3. Geração do Token usando a variável de ambiente
        const token = jwt.sign(
            {
                id: usuario.id,
                clinica_id: usuario.clinica_id,
                cargo: usuario.cargo
            },
            process.env.JWT_SECRET, // Lendo do seu .env
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // 4. Resposta para o Frontend
        res.json({
            message: "Bem-vindo ao Sistema Terapêutico!",
            token: token,
            usuario: {
                nome: usuario.nome,
                cargo: usuario.cargo,
                clinica: usuario.nome_clinica
            }
        });

    } catch (error) {
        console.error("Erro no Login:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};