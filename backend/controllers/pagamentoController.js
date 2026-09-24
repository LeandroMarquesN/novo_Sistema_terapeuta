// controllers/pagamentoController.js
const { MercadoPagoConfig, Preference } = require('mercadopago');
const db = require('../config/db');
const notificationService = require('../services/notificationService'); // Ajuste o caminho se necessário

// Configura o client do Mercado Pago usando a variável de ambiente do Render
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// 1. Criar Preferência de Checkout Pro (Chamado pelo frontend ao clicar em comprar)
// controllers/pagamentoController.js (Trecho atualizado da criação de preferência)
exports.criarPreferenciaWhatsApp = async (req, res) => {
    try {
        const clinicaId = req.usuario.clinica_id;
        const { pacote } = req.body; // Recebe 50, 100, 300, 500 ou 1000

        const quantidadeCreditos = Number(pacote);
        const pacotesPermitidos = [50, 100, 300, 500, 1000];

        if (!pacotesPermitidos.includes(quantidadeCreditos)) {
            return res.status(400).json({ erro: 'Pacote de créditos inválido.' });
        }

        const precoUnitarioVenda = 0.45; // Custo base 0.35 + 0.10 da sua margem
        const valorTotal = Number((quantidadeCreditos * precoUnitarioVenda).toFixed(2));

        const [[clinica]] = await db.query('SELECT nome_clinica, email_master FROM clinicas WHERE id = ?', [clinicaId]);
        if (!clinica) return res.status(404).json({ erro: 'Clínica não encontrada.' });

        const preference = new Preference(client);
        const resultado = await preference.create({
            body: {
                items: [
                    {
                        id: `wa_pacote_${quantidadeCreditos}`,
                        title: `Pacote de ${quantidadeCreditos} Disparos de WhatsApp — MedLM`,
                        quantity: 1,
                        unit_price: valorTotal,
                        currency_id: 'BRL',
                    },
                ],
                payer: {
                    email: clinica.email_master,
                },
                back_urls: {
                    success: `${process.env.APP_BASE_URL_ENV || 'http://localhost:3000'}/marketing?pagamento=sucesso`,
                    failure: `${process.env.APP_BASE_URL_ENV || 'http://localhost:3000'}/marketing?pagamento=erro`,
                    pending: `${process.env.APP_BASE_URL_ENV || 'http://localhost:3000'}/marketing?pagamento=pendente`,
                },
                auto_return: 'approved',
                notification_url: `${process.env.APP_BASE_URL_ENV || 'http://localhost:3000'}/api/pagamentos/webhook`,
                external_reference: String(clinicaId),
            },
        });

        return res.json({ init_point: resultado.init_point });
    } catch (err) {
        console.error('[PAGAMENTO] Erro ao criar preferência:', err);
        res.status(500).json({ erro: 'Erro ao gerar pagamento.' });
    }
};

// 2. Webhook para receber a confirmação de pagamento do Mercado Pago
exports.webhookMercadoPago = async (req, res) => {
    try {
        const { action, data } = req.body;

        if (action === 'payment.created' || req.body.type === 'payment') {
            const paymentId = data?.id || req.body.data?.id;

            // Consulta o status do pagamento diretamente na API do Mercado Pago
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
            });
            const pagamento = await response.json();

            if (pagamento.status === 'approved') {
                const clinicaId = Number(pagamento.external_reference);
                const itens = pagamento.additional_info?.items || [];

                // Identifica quantos créditos foram comprados pelo ID do item
                let creditosComprados = 500;
                const itemEncontrado = itens.find(i => i.id && i.id.startsWith('wa_pacote_'));
                if (itemEncontrado) {
                    const partes = itemEncontrado.id.split('_');
                    creditosComprados = Number(partes[2]) || 500;
                }

                // Verifica se essa compra já foi processada para evitar duplicidade
                const [[jaProcessado]] = await db.query(
                    'SELECT id FROM whatsapp_compras_creditos WHERE gateway_payment_id = ?',
                    [String(paymentId)]
                );

                if (!jaProcessado) {
                    // Registra a compra na tabela de histórico
                    await db.query(
                        `INSERT INTO whatsapp_compras_creditos (clinica_id, quantidade_creditos, valor_total, status_pagamento, gateway_payment_id)
             VALUES (?, ?, ?, 'aprovado', ?)`,
                        [clinicaId, creditosComprados, pagamento.transaction_amount, String(paymentId)]
                    );

                    // Adiciona os créditos na tabela clinicas
                    await db.query(
                        'UPDATE clinicas SET whatsapp_creditos = whatsapp_creditos + ? WHERE id = ?',
                        [creditosComprados, clinicaId]
                    );

                    // Busca dados da clínica para enviar o e-mail transacional de confirmação
                    const [[clinica]] = await db.query('SELECT nome_clinica, email_master FROM clinicas WHERE id = ?', [clinicaId]);
                    if (clinica && clinica.email_master) {
                        await notificationService.sendHtmlEmail({
                            to: clinica.email_master,
                            subject: `✅ Compra de Créditos de WhatsApp Aprovada — ${clinica.nome_clinica}`,
                            html: `
                <div style="font-family: 'Inter', Arial, sans-serif; background-color: #020c12; color: #cbd5e1; padding: 40px; border-radius: 16px; max-width: 600px; margin: auto; border: 1px solid rgba(52,211,153,0.2);">
                  <h2 style="color: #34d399; font-family: 'Space Grotesk', sans-serif;">Recarga de WhatsApp Concluída!</h2>
                  <p>Olá, gestor da clínica <strong>${clinica.nome_clinica}</strong>,</p>
                  <p>O pagamento do seu pacote de <strong>${creditosComprados} créditos de WhatsApp</strong> foi aprovado com sucesso pelo Mercado Pago.</p>
                  <p>Os créditos já foram creditados em sua conta e estão prontos para uso em suas campanhas e lembretes.</p>
                  <p style="font-size: 11px; color: rgba(148,163,184,0.4); text-align: center; margin-top: 30px;">© ${new Date().getFullYear()} MedLM - Sistema Clínico Inteligente</p>
                </div>
              `,
                            fromName: 'MedLM Financeiro'
                        }).catch(err => console.error('[PAGAMENTO] Erro ao enviar email de confirmação:', err));
                    }
                }
            }
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error('[PAGAMENTO] Erro no webhook:', err);
        return res.status(500).json({ erro: 'Erro ao processar webhook.' });
    }
};

// --funcao para testar owhatassaap sem gastar e nem colocar creditos

exports.simularPagamentoTeste = async (req, res) => {
    try {
        const clinicaId = req.usuario.clinica_id;
        const { pacote } = req.body; // Ex: 50, 100, 300, 500, 1000

        const quantidadeCreditos = Number(pacote) || 50;

        // 1. Adiciona os créditos diretamente na tabela da clínica
        await db.query(
            'UPDATE clinicas SET whatsapp_creditos = whatsapp_creditos + ? WHERE id = ?',
            [quantidadeCreditos, clinicaId]
        );

        // 2. Registra a compra simulada no histórico para aparecer nas métricas
        await db.query(
            `INSERT INTO whatsapp_compras_creditos (clinica_id, quantidade_creditos, valor_pago, status_pagamento, criado_em) 
       VALUES (?, ?, ?, 'aprovado', NOW())`,
            [clinicaId, quantidadeCreditos, 0.00]
        );

        console.log(`[TESTE] Adicionados ${quantidadeCreditos} créditos de WhatsApp para a clínica ID ${clinicaId} (Simulação)`);

        return res.json({
            sucesso: true,
            mensagem: `Simulação concluída! ${quantidadeCreditos} créditos adicionados com sucesso.`
        });
    } catch (err) {
        console.error('[TESTE] Erro ao simular pagamento:', err);
        return res.status(500).json({ erro: 'Erro ao processar simulação de teste.' });
    }
};