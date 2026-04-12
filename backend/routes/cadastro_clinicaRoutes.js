const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/register-clinica', async (req, res) => {
    const { nome_clinica, dono_nome, email_master, senha_master } = req.body;

    if (!nome_clinica || !dono_nome || !email_master || !senha_master) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    // Pega uma conexão do pool para iniciar a transação
    const connection = await db.getConnection();

    try {
        // INÍCIO DA TRANSAÇÃO (Tudo ou Nada)
        await connection.beginTransaction();

        // 1. Criar a Clínica na tabela 'clinicas'
        const [resultClinica] = await connection.execute(
            'INSERT INTO clinicas (nome_clinica, dono_nome, email_master, senha_master) VALUES (?, ?, ?, ?)',
            [nome_clinica, dono_nome, email_master, senha_master]
        );

        const novaClinicaId = resultClinica.insertId;

        // 2. Criar o Usuário "Dono" vinculado na tabela 'usuarios'
        await connection.execute(
            'INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)',
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        // Se chegou aqui sem erro, confirma as duas gravações no banco
        await connection.commit();

        console.log(`✅ Sucesso: Clínica e Usuário criados com ID ${novaClinicaId}`);
        res.status(201).json({
            message: 'Clínica e administrador cadastrados com sucesso!',
            clinicaId: novaClinicaId
        });

    } catch (error) {
        // Se der qualquer erro (no 1 ou no 2), desfaz o que foi feito
        await connection.rollback();

        console.error("❌ Erro no cadastro de clínica:", error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Este e-mail já está em uso.' });
        }

        res.status(500).json({ error: 'Erro interno no servidor ao realizar cadastro.' });
    } finally {
        // IMPORTANTE: Devolve a conexão para o pool
        connection.release();
    }
});

module.exports = router;