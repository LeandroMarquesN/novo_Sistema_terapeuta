router.post('/register-clinica', async (req, res) => {
    // 1. Recebe os dados do corpo (incluindo os que vêm da URL escondidos no formulário)
    const {
        nome_clinica, dono_nome, email_master, senha_master,
        telefone_clinica, telefone_dono, plano_id, origem_cadastro
    } = req.body;

    // 2. Lógica de "Fundador"
    let status_pagamento = 'trial';
    let data_expiracao = new Date();

    // Se for fundador, damos 90 dias (3 meses) a mais
    if (origem_cadastro === 'fundador') {
        data_expiracao.setDate(data_expiracao.getDate() + 90);
    } else {
        data_expiracao.setDate(data_expiracao.getDate() + 7); // Trial padrão de 7 dias
    }

    // 3. Inserção com as novas colunas que criamos no init.sql
    const [result] = await connection.execute(
        `INSERT INTO clinicas (
            nome_clinica, slug, dono_nome, email_master, senha_master, 
            telefone_clinica, telefone_dono, plano_id, 
            origem_cadastro, tipo_plano, data_expiracao, status_pagamento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            nome_clinica, gerarSlug(nome_clinica), dono_nome, email_master, senha_master,
            telefone_clinica, telefone_dono, plano_id,
            origem_cadastro, (origem_cadastro === 'fundador' ? 'FUNDADOR' : 'PADRAO'),
            data_expiracao, status_pagamento
        ]
    );

    // ... restante do seu código de resposta
});