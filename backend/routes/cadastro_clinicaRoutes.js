const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Certifique-se que o caminho da conexão está correto

// Rota: POST /api/auth/register-clinica
router.post('/register-clinica', async (req, res) => {
    const { nome_clinica, dono_nome, email_master, senha_master } = req.body;

    // 1. Validação básica de campos
    if (!nome_clinica || !dono_nome || !email_master || !senha_master) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    try {
        // Usamos db.execute ou db.query (mysql2/promise)

        // 2. Criar a Clínica na tabela 'clinicas'
        const [resultClinica] = await db.execute(
            'INSERT INTO clinicas (nome_clinica, dono_nome, email_master, senha_master) VALUES (?, ?, ?, ?)',
            [nome_clinica, dono_nome, email_master, senha_master]
        );

        const novaClinicaId = resultClinica.insertId;

        // 3. Criar o Usuário "Dono" vinculado a essa clínica na tabela 'usuarios'
        // IMPORTANTE: O cargo 'dono' deve existir no seu ENUM do banco de dados
        await db.execute(
            'INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)',
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        console.log(`✅ Sucesso: Clínica "${nome_clinica}" e usuário "${dono_nome}" criados.`);

        res.status(201).json({
            message: 'Clínica e administrador cadastrados com sucesso!',
            clinicaId: novaClinicaId
        });

    } catch (error) {
        console.error("❌ Erro no cadastro de clínica:", error);

        // Trata erro de e-mail duplicado (Unique Key no MySQL)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Este e-mail já está em uso.' });
        }

        res.status(500).json({ error: 'Erro interno no servidor ao realizar cadastro.' });
    }
});

module.exports = router;