const express = require('express');
const router = express.Router();
const db = require('../config/db');
const notificacaoService = require('../services/notificationService');

router.post('/register-clinica', async (req, res) => {
    // 1. Capturamos o plano_id que vem do novo HTML
    const {
        nome_clinica,
        dono_nome,
        telefone_clinica,
        telefone_dono,
        email_master,
        senha_master,
        plano_id
    } = req.body;

    // Validação básica
    if (!nome_clinica || !dono_nome || !email_master || !senha_master || !plano_id) {
        return res.status(400).json({ error: "Campos obrigatórios faltando, inclusive o plano." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 2. Lógica de Datas (Regra de Negócio)
        const data_cadastro = new Date();
        const data_expiracao = new Date();
        data_expiracao.setMonth(data_expiracao.getMonth() + 1); // 30 dias de acesso inicial

        // 3. INSERT NA TABELA CLINICAS (Atualizado com plano_id e datas)
        const [resultClinica] = await connection.execute(
            `INSERT INTO clinicas
            (nome_clinica, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master, plano_id, data_expiracao, data_cadastro, valor_atual)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_clinica,
                dono_nome,
                telefone_clinica,
                telefone_dono,
                email_master,
                senha_master,
                plano_id,        // ID vindo do HTML (1, 2 ou 3)
                data_expiracao,  // Calculado acima
                data_cadastro,   // Hoje
                69.90            // Valor promocional de entrada
            ]
        );

        const novaClinicaId = resultClinica.insertId;

        // 4. Criar o Usuário Dono (Isolamento Multitenancy)
        await connection.execute(
            'INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)',
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        await connection.commit();

        console.log(`✅ Sucesso: Clínica ${nome_clinica} criada com ID ${novaClinicaId}`);

        // 5. DISPARAR NOTIFICAÇÃO (E-mail de Boas-vindas)
        // Passamos os dados para o seu serviço que já funciona
        notificacaoService.sendWelcomeEmail({
            nome_clinica,
            dono_nome,
            email_master,
            senha_master,
            data_expiracao: data_expiracao.toLocaleDateString('pt-BR')
        }).catch(err => console.error("Erro no envio do e-mail:", err));

        // 6. Resposta para o Frontend (Isso ativa o seu MODAL DE SUCESSO)
        return res.status(201).json({
            success: true,
            message: 'Clínica cadastrada com sucesso!',
            clinicaId: novaClinicaId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Erro no cadastro:", error);

        // Se o erro for de e-mail duplicado
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Este e-mail já está em uso." });
        }

        return res.status(500).json({ error: "Erro interno no servidor." });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;