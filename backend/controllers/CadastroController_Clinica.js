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
    console.log(`[MED-LM] 📩 Iniciando e-mail de boas vindas para: ${clinica.email_master}`);

    // DEBUG CRÍTICO: Veja o que está vindo do banco
    console.log("[DEBUG] Dados recebidos:", {
        email: clinica.email_master,
        senha: clinica.senha_master
    });

    try {
        const templatePath = path.join(__dirname, '..', 'templates', 'boas_vindas.html');
        const htmlTemplateOriginal = await fs.readFile(templatePath, 'utf-8');

        const planos = { 1: 'Trial', 2: 'Premium', 3: 'Enterprise' };

        // Mapeamento correto para o que você usa no HTML
        const templateData = {
            dono_nome: clinica.dono_nome,
            nome_clinica: clinica.nome_clinica,
            email: clinica.email_master, // <--- Esta chave tem que ser {{email}} no HTML
            senha: clinica.senha_master, // <--- Esta chave tem que ser {{senha}} no HTML
            plano_nome: planos[clinica.plano_id] || 'Plano Personalizado',
            url_portal: `${process.env.APP_BASE_URL_ENV}/agendar/${clinica.slug}`,
            qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${process.env.APP_BASE_URL_ENV}/agendar/${clinica.slug}`)}`,
            data_expiracao: clinica.data_expiracao,
            ano_atual: new Date().getFullYear()
        };

        // Substituição
        const htmlFinal = replacePlaceholders(htmlTemplateOriginal, templateData);

        console.log("--- TESTE DE SUBSTITUIÇÃO ---");
        console.log("Template antes:", htmlTemplateOriginal.substring(0, 100)); // Para ver se o template carregou
        console.log("Dados:", templateData);
        console.log("HTML Final:", htmlFinal.substring(0, 500)); // Veja se o email e a senha aparecem aqui!
        console.log("-----------------------------");

        await transporter.sendMail({
            from: `"MedLM - Sistema Inteligente" <${process.env.EMAIL_USER}>`,
            to: clinica.email_master,
            subject: 'Bem-vindo ao MedLM',
            html: htmlFinal
        });

        console.log("[MED-LM] ✅ E-mail de boas vindas enviado!");
    } catch (error) {
        console.error(`[MED-LM] ❌ ERRO NO ENVIO:`, error.message);
    }
};

// ============================================================
// 2. A FUNÇÃO DE REGISTRO (ATUALIZADA COM SLUG)
// ============================================================
exports.registerClinica = async (req, res) => {
    const {
        nome_clinica, dono_nome, email_master, senha_master,
        telefone_clinica, telefone_dono, plano_id
    } = req.body;

    const EMAIL_TESTE = 'leandrommarquess.n@gmail.com';
    const conn = await db.getConnection();

    try {
        // --- LÓGICA DE TESTE (Autolimpeza) ---
        if (email_master.toLowerCase() === EMAIL_TESTE) {
            console.log("--- 🧪 MODO TESTE ATIVADO PARA: " + email_master + " ---");
            // Remove registros antigos deste e-mail para não travar no duplicado
            await conn.execute('DELETE u FROM usuarios u JOIN clinicas c ON u.clinica_id = c.id WHERE c.email_master = ?', [EMAIL_TESTE]);
            await conn.execute('DELETE FROM clinicas WHERE email_master = ?', [EMAIL_TESTE]);
        } else {
            // --- LÓGICA DE PRODUÇÃO (Bloqueio de duplicados) ---
            const [existe] = await conn.execute('SELECT id FROM clinicas WHERE email_master = ?', [email_master.toLowerCase()]);
            if (existe.length > 0) {
                return res.status(409).json({ error: "Este e-mail já possui uma clínica cadastrada." });
            }
        }

        await conn.beginTransaction();

        // 1. Buscar valores do plano escolhido
        const [planos] = await conn.execute('SELECT valor_base, valor_promocional FROM planos WHERE id = ?', [plano_id]);
        if (planos.length === 0) throw new Error("Plano não encontrado");
        const plano = planos[0];

        // 2. Verificar se é Fundador
        const [fundadorCheck] = await conn.execute(
            'SELECT id FROM lista_espera WHERE email = ?',
            [email_master.toLowerCase()]
        );
        const isFundador = fundadorCheck.length > 0;

        // 3. Cálculo das datas
        const hoje = new Date();
        let data_fim_gratuidade = new Date();

        if (isFundador) {
            data_fim_gratuidade.setDate(hoje.getDate() + 90);
        } else {
            data_fim_gratuidade = new Date(hoje);
        }

        let data_fim_promocao = new Date(data_fim_gratuidade);
        data_fim_promocao.setDate(data_fim_promocao.getDate() + 60);

        const valor_inicial = isFundador ? 0 : plano.valor_promocional;

        // 4. Inserção Clínica
        const [resultClinica] = await conn.execute(
            `INSERT INTO clinicas
            (nome_clinica, slug, dono_nome, email_master, senha_master, telefone_clinica, telefone_dono, 
             plano_id, tipo_plano, data_cadastro, data_expiracao, 
             data_fim_gratuidade, data_fim_promocao, valor_atual, status_pagamento)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_clinica, gerarSlug(nome_clinica), dono_nome, email_master, senha_master,
                telefone_clinica, telefone_dono, plano_id,
                (isFundador ? 'FUNDADOR' : 'PADRAO'),
                hoje.toISOString().split('T')[0],
                data_fim_gratuidade.toISOString().split('T')[0],
                data_fim_gratuidade.toISOString().split('T')[0],
                data_fim_promocao.toISOString().split('T')[0],
                valor_inicial,
                'trial'
            ]
        );

        const novaClinicaId = resultClinica.insertId;

        // 5. Inserção Usuário
        await conn.execute(
            `INSERT INTO usuarios (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, ?)`,
            [novaClinicaId, dono_nome, email_master, senha_master, 'dono']
        );

        await conn.commit();

        // 6. Envio de E-mail (agora vai rodar porque não houve erro de duplicidade!)
        const [clinicaRecemCriada] = await conn.execute('SELECT * FROM clinicas WHERE id = ?', [novaClinicaId]);
        await notificacaoService.sendWelcomeEmail(clinicaRecemCriada[0]);

        res.status(201).json({ message: "Clínica criada!", portalUrl: `/agendar/${gerarSlug(nome_clinica)}` });

    } catch (error) {
        await conn.rollback();
        console.error("Erro no cadastro:", error);
        res.status(500).json({ error: "Erro interno: " + error.message });
    } finally {
        conn.release();
    }
};