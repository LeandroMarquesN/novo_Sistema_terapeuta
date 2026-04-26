const express = require('express');
const router = express.Router();
const db = require('../config/db');
const notificacaoService = require('../services/notificationService');

router.post('/register-clinica', async (req, res) => {
    const { nome_clinica, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master } = req.body;

    if (!nome_clinica || !dono_nome || !telefone_clinica || !telefone_dono || !email_master || !senha_master) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // CORREÇÃO AQUI: Adicionado os campos e os valores correspondentes
        const [resultClinica] = await connection.execute(
            'INSERT INTO clinicas (nome_clinica, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master) VALUES (?, ?, ?, ?, ?, ?)',
            [nome_clinica, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master]
        );

        const novaClinicaId = resultClinica.insertId;

        // 2. Criar o Usuário Dono (CORREÇÃO AQUI: 5 campos = 5 interrogações)
        // Removido o 'nome_clinica' daqui, pois a tabela 'usuarios' foca na pessoa.
        await connection.execute(
            'INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)',
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        await connection.commit();
        console.log(`✅ Sucesso: Clínica e Usuário criados com ID ${novaClinicaId}`);

        // 3. ENVIAR E-MAIL (Agora com os dados certos)
        console.log("Chamando o serviço de e-mail...");
        // Não usamos 'await' aqui para a resposta ser instantânea para o usuário
        notificacaoService.sendWelcomeEmail({
            nome_clinica,
            dono_nome,
            telefone_clinica, // Agora o e-mail pode usar isso!
            email_master,
            senha_master
        });

        // 4. Resposta única para o Frontend
        return res.status(201).json({
            success: true,
            message: 'Clínica e administrador cadastrados com sucesso!',
            clinicaId: novaClinicaId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Erro no cadastro de clínica:", error.message);

        if (!res.headersSent) {
            return res.status(500).json({ error: "Erro ao processar cadastro." });
        }
    } finally {
        if (connection) connection.release(); // LIBERA A CONEXÃO (Muito importante!)
    }
});

module.exports = router;