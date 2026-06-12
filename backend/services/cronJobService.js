const db = require('../config/db');

// Esta função deve ser chamada uma vez por dia por um agendador (como node-cron)
exports.verificarViradaDePreco = async () => {
    const conn = await db.getConnection();
    try {
        console.log("Iniciando verificação de virada de preço...");

        // 1. Atualiza o valor para o valor_base do plano para quem a promoção acabou hoje
        // O SQL busca quem tem a data_fim_promocao igual a hoje
        const [result] = await conn.execute(`
            UPDATE clinicas c
            JOIN planos p ON c.plano_id = p.id
            SET c.valor_atual = p.valor_base,
                c.status_pagamento = 'ativo'
            WHERE c.data_fim_promocao = CURDATE() 
            AND c.status_pagamento != 'cancelado'
        `);

        if (result.affectedRows > 0) {
            console.log(`✅ Sucesso: ${result.affectedRows} clínicas tiveram o plano atualizado para o valor base hoje.`);
            // AQUI você chamaria o seu serviço de envio de e-mail para avisar esses clientes
        } else {
            console.log("Nenhuma clínica precisou de atualização de preço hoje.");
        }

    } catch (error) {
        console.error("❌ Erro ao processar virada de preço:", error);
    } finally {
        conn.release();
    }
};