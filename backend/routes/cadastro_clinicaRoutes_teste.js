const express = require('express');
const router = express.Router();
const db = require('../config/db');
const notificacaoService = require('../services/notificationService');

router.post('/register-clinica', async (req, res) => {
    // 1. Capturamos o plano_id que vem do novo HTML
    const {
        nome_clinica, dono_nome, telefone_clinica, telefone_dono,
        email_master, senha_master, plano_id, origem_cadastro
    } = req.body;

    // Validação básica
    if (!nome_clinica || !dono_nome || !email_master || !senha_master || !plano_id) {
        return res.status(400).json({ error: "Campos obrigatórios faltando, inclusive o plano." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        // Lógica de Identificação
        const isFundador = (origem_cadastro === 'fundador' || origem_cadastro === 'LADING_PAGE');

        // 2. Lógica de Datas e Valores
        const data_cadastro = new Date();
        let data_expiracao = new Date();

        // Se for fundador: 90 dias e 69.90. Se for padrão: 30 dias e 89.90
        if (isFundador) {
            data_expiracao.setDate(data_cadastro.getDate() + 90);
        } else {
            data_expiracao.setDate(data_cadastro.getDate() + 30);
        }

        const valor_atual = 89.90; // Mudança aplicada aqui!

        // --- LOGICA DO SLUG (Coloque isso antes do INSERT se ainda não tiver) ---
        const slug = nome_clinica
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9 -]/g, '')     // Remove caracteres especiais
            .replace(/\s+/g, '-')            // Espaço vira hifen
            .replace(/-+/g, '-');            // Evita hifens duplos


        // 3. INSERT NA TABELA CLINICAS (Agora com a coluna slug)
        const data_cadastro_sql = data_cadastro.toISOString().split('T')[0];
        const data_expiracao_sql = data_expiracao.toISOString().split('T')[0];

        // 3. INSERT NA TABELA CLINICAS
        const [resultClinica] = await connection.execute(
            `INSERT INTO clinicas
            (nome_clinica, slug, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master, 
             plano_id, data_expiracao, data_cadastro, valor_atual, origem_cadastro, tipo_plano)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_clinica, slug, dono_nome, telefone_clinica, telefone_dono, email_master, senha_master,
                plano_id,
                data_expiracao_sql, // Agora como string formatada
                data_cadastro_sql,  // Agora como string formatada
                valor_atual,
                (origem_cadastro || 'direto'),
                (isFundador ? 'FUNDADOR' : 'PADRAO')
            ]
        );

        const novaClinicaId = resultClinica.insertId;

        // 4. Criar o Usuário Dono (Isolamento Multitenancy) - AQUI SEGUE IGUAL
        await connection.execute(
            'INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)',
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        await connection.commit();

        console.log(`✅ Sucesso: Clínica ${nome_clinica} criada com ID ${novaClinicaId}`);

        console.log(`✅ Sucesso: Clínica ${nome_clinica} criada com ID ${novaClinicaId}`);

        // 5. DISPARAR NOTIFICAÇÃO (E-mail de Boas-vindas)
        notificacaoService.sendWelcomeEmail({
            nome_clinica,
            slug,          // Necessário para o Link do Portal e QR Code
            dono_nome,
            email_master,
            senha_master,
            plano_id,      // ESSENCIAL para mostrar qual plano ela contratou
            data_expiracao: data_expiracao.toLocaleDateString('pt-BR') // Data formatada
        }).catch(err => console.error("Erro no envio do e-mail:", err));

        // 6. Resposta para o Frontend (IMPORTANTE PARA O MODAL)
        return res.status(201).json({
            success: true,
            message: 'Clínica cadastrada com sucesso!',
            clinicaId: novaClinicaId,
            portalUrl: `/agendar/${slug}` // <--- ADICIONE ISSO para o Modal e o QR Code funcionarem!
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