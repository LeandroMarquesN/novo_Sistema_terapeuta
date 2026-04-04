// Rota de Registro de Nova Clínica
app.post('/Cadastro_Clinica', async (req, res) => {
    const { nome_clinica, dono_nome, email, senha } = req.body;

    // 1. Cria a Clínica
    const queryClinica = "INSERT INTO clinicas (nome_clinica, dono_nome, email_master, senha_master) VALUES (?, ?, ?, ?)";
    const result = await db.execute(queryClinica, [nome_clinica, dono_nome, email, senha]);

    const novaClinicaId = result.insertId;

    // 2. Cria o primeiro Membro (O Dono também é um usuário do sistema)
    const queryMembro = "INSERT INTO membros_equipe (clinica_id, nome, email, senha, cargo) VALUES (?, ?, ?, ?, 'administrador')";
    await db.execute(queryMembro, [novaClinicaId, dono_nome, email, senha]);

    res.send("Conta criada com sucesso! Verifique seu e-mail.");
});