// Importe seu serviço de notificações
const notificacaoService = require('../services/notificationService');
const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;

// ============================================================
// FUNÇÃO AUXILIAR: GERADOR DE SLUG
// ============================================================
const gerarSlug = (texto) => {
    return texto
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD') // Decompõe caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
        .replace(/[^a-z0-9 -]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Substitui espaços por hifens
        .replace(/-+/g, '-'); // Remove hifens duplos
};

// ===========================================
// FUNCAO PARA DAR BOAS VINDAS A NOVA CLINICA
// ===========================================
exports.sendWelcomeEmail = async (clinica) => {
    // ... (Mantenha sua função de e-mail como está, ela está correta)
};

// ============================================================
// 2. A FUNÇÃO DE REGISTRO (ATUALIZADA COM SLUG)
// ============================================================
exports.registerClinica = async (req, res) => {
    const {
        nome_clinica,
        dono_nome,
        email_master,
        senha_master,
        telefone_clinica,
        telefone_dono,
        plano_id
    } = req.body;

    // GERANDO O SLUG DINAMICAMENTE
    const slug = gerarSlug(nome_clinica);

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        // 1. Lógica de Datas
        const data_cadastro = new Date();
        const data_expiracao = new Date();
        data_expiracao.setMonth(data_expiracao.getMonth() + 1);

        // 2. Inserir a Clínica (INCLUINDO O SLUG)
        const [resultClinica] = await conn.execute(
            `INSERT INTO clinicas
            (nome_clinica, slug, dono_nome, email_master, senha_master, telefone_clinica, telefone_dono, plano_id, data_expiracao, valor_atual, data_cadastro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_clinica,
                slug, // Inserindo o slug gerado
                dono_nome,
                email_master,
                senha_master,
                telefone_clinica,
                telefone_dono,
                plano_id,
                data_expiracao,
                69.90,
                data_cadastro
            ]
        );

        const novaClinicaId = resultClinica.insertId;

        // 3. Criar o primeiro usuário (Dono)
        await conn.execute(
            `INSERT INTO usuarios (clinica_id, nome, email, senha, cargo)
             VALUES (?, ?, ?, ?, ?)`,
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        await conn.commit();

        // 4. Disparar Notificações
        const dadosClinicaParaEnvio = {
            ...req.body,
            id: novaClinicaId,
            slug: slug, // Enviando o slug para o e-mail também se quiser
            data_expiracao: data_expiracao.toLocaleDateString('pt-BR')
        };

        this.sendWelcomeEmail(dadosClinicaParaEnvio).catch(err => console.error("Erro envio email:", err));

        res.status(201).json({
            message: "Clínica e usuário master criados com sucesso!",
            clinicaId: novaClinicaId,
            portalUrl: `/agendar/${slug}` // Retornamos a URL para o front-end se precisar
        });

    } catch (error) {
        await conn.rollback();
        console.error("Erro no Registro de Clínica:", error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Este e-mail ou nome de clínica já existe." });
        }

        res.status(500).json({ error: "Erro interno ao criar clínica." });
    } finally {
        conn.release();
    }
};