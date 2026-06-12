exports.registerClinica = async (req, res) => {
    const { email_master, plano_id, /* ... outros campos */ } = req.body;
    const conn = await db.getConnection();

    try {
        // 1. Buscar valores do plano escolhido
        const [planos] = await conn.execute('SELECT valor_base, valor_promocional FROM planos WHERE id = ?', [plano_id]);
        const plano = planos[0];

        // 2. Verificar se é Fundador (está na lista de espera)
        const [fundadorCheck] = await conn.execute('SELECT id FROM lista_espera WHERE email = ?', [email_master.toLowerCase()]);
        const isFundador = fundadorCheck.length > 0;

        // 3. Lógica de Datas
        const hoje = new Date();
        let data_fim_gratuidade = new Date();
        let data_fim_promocao = new Date();

        if (isFundador) {
            // Regra Fundador: 90 dias grátis + 60 dias promocionais
            data_fim_gratuidade.setDate(hoje.getDate() + 90);
            data_fim_promocao = new Date(data_fim_gratuidade);
            data_fim_promocao.setDate(data_fim_promocao.getDate() + 60);
        } else {
            // Regra Padrão: 0 dias grátis + 60 dias promocionais
            data_fim_gratuidade = hoje;
            data_fim_promocao = new Date(hoje);
            data_fim_promocao.setDate(data_fim_promocao.getDate() + 60);
        }

        // 4. Inserção
        await conn.execute(
            `INSERT INTO clinicas (..., valor_atual, data_fim_gratuidade, data_fim_promocao, tipo_plano) VALUES (...)`,
            [
                // O valor_atual começa como 0 (se está na gratuidade) ou valor_promocional
                isFundador ? 0 : plano.valor_promocional,
                data_fim_gratuidade,
                data_fim_promocao,
                isFundador ? 'FUNDADOR' : 'PADRAO'
            ]
        );

        // ... resto do código
    } catch (error) { ... }
};