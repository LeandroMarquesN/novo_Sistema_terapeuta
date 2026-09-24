// services/whatsappService.js
require('dotenv').config();
const db = require('../config/db');

/**
 * Dispara uma mensagem de WhatsApp via API da Brevo e desconta 1 crédito da clínica.
 */
exports.enviarWhatsApp = async (clinicaId, telefoneDestino, mensagem) => {
    try {
        // 1. Verifica se a clínica tem créditos disponíveis
        const [[clinica]] = await db.query('SELECT whatsapp_creditos, nome_clinica FROM clinicas WHERE id = ?', [clinicaId]);

        if (!clinica || clinica.whatsapp_creditos <= 0) {
            console.warn(`[WHATSAPP] Clínica ID ${clinicaId} tentou enviar mensagem, mas está sem créditos.`);
            throw new Error('Créditos de WhatsApp esgotados. Faça uma recarga para continuar.');
        }

        // Formata o telefone (remove caracteres não numéricos e garante DDI 55 se necessário)
        const numeroLimpo = telefoneDestino.replace(/\D/g, '');
        const numeroFormatado = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;

        // 2. Chamada para a API da Brevo WhatsApp
        const response = await fetch('https://api.brevo.com/v3/whatsapp/sendMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.BREVO_API_KEY // Usa a sua chave global do Brevo
            },
            body: JSON.stringify({
                senderNumber: process.env.BREVO_WHATSAPP_SENDER || '', // Seu número remetente cadastrado na Brevo
                contactNumber: numeroFormatado,
                text: mensagem
            })
        });

        if (!response.ok) {
            const erroData = await response.json();
            throw new Error(erroData.message || 'Erro ao enviar WhatsApp via Brevo');
        }

        // 3. Abate 1 crédito do saldo da clínica no banco de dados
        await db.query('UPDATE clinicas SET whatsapp_creditos = whatsapp_creditos - 1 WHERE id = ?', [clinicaId]);

        console.log(`[WHATSAPP] Mensagem enviada com sucesso para ${numeroFormatado} pela clínica ${clinica.nome_clinica}`);
        return true;
    } catch (err) {
        console.error('[WHATSAPP] Erro no envio:', err.message);
        throw err;
    }
};