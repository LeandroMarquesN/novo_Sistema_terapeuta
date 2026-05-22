const db = require('../config/db');

const dashboardController = {
  index: async (req, res) => {
    try {
      // 1. Log para saber se o middleware passou o usuário certo
      console.log("DEBUG: Dados do usuário no token:", req.usuario);

      if (!req.usuario || !req.usuario.clinica_id) {
        console.error("ERRO: clinica_id não encontrado no token!");
        return res.status(403).send("Erro de identificação da clínica. Faça login novamente.");
      }

      const clinicaId = req.usuario.clinica_id;

      // 2. Busca os agendamentos da clínica no banco de dados
      const query = `
                SELECT id, nome, data_agendamento, status_agendamento, tipo_terapia, telefone
                FROM agendamentos
                WHERE clinica_id = ?
                ORDER BY data_agendamento DESC
            `;

      const [rows] = await db.execute(query, [clinicaId]);
      console.log(`SUCESSO: ${rows.length} agendamentos encontrados.`);

      // 3. ESTRUTURAS PARA O CALENDÁRIO E PARA OS GRÁFICOS (INICIALIZAÇÃO)
      const resumoMensal = {};
      const fluxoSemanal = { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 };
      const diasNome = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      // Nova estrutura para alimentar as 4 semanas isoladas do mês inteiro
      const fluxoMensalSemanas = {
        "Semana 1": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 },
        "Semana 2": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 },
        "Semana 3": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 },
        "Semana 4": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 }
      };

      // 4. UM ÚNICO LOOP PARA PROCESSAR TUDO
      rows.forEach(agend => {
        const dataObj = new Date(agend.data_agendamento);
        const diaReal = dataObj.getDate(); // Extrai o dia do mês (1 a 31)

        // Regra de Negócio: Ignora os agendamentos cancelados tanto no calendário quanto nos gráficos
        if (agend.status_agendamento !== 'cancelado') {

          // --- LÓGICA DO CALENDÁRIO ---
          const horaMinuto = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          if (!resumoMensal[diaReal]) {
            resumoMensal[diaReal] = { total: 0, horarios: [] };
          }
          resumoMensal[diaReal].total += 1;
          resumoMensal[diaReal].horarios.push(horaMinuto);

          // --- LÓGICA DO GRÁFICO SEMANAL ATUAL ---
          const diaSemanaNome = diasNome[dataObj.getDay()]; // Converte o número do dia (0-6) para texto ("Dom"-"Sáb")
          if (fluxoSemanal[diaSemanaNome] !== undefined) {
            fluxoSemanal[diaSemanaNome] += 1; // Soma +1 atendimento naquele dia da semana
          }

          // --- LÓGICA DOS 4 GRÁFICOS DAS SEMANAS DO MÊS ---
          // Divide os dias do mês: 1-7 (S1), 8-14 (S2), 15-21 (S3), 22+ (S4)
          let numeroSemana = Math.ceil(diaReal / 7);
          if (numeroSemana > 4) numeroSemana = 4; // Agrupa os dias 29, 30 e 31 na Semana 4

          const labelSemana = `Semana ${numeroSemana}`;
          if (fluxoMensalSemanas[labelSemana] && fluxoMensalSemanas[labelSemana][diaSemanaNome] !== undefined) {
            fluxoMensalSemanas[labelSemana][diaSemanaNome] += 1;
          }
        }
      });

      // Transforma o array de horários do calendário em uma string separada por vírgulas
      Object.keys(resumoMensal).forEach(dia => {
        resumoMensal[dia].horarios = resumoMensal[dia].horarios.join(', ');
      });

      // Organiza os dados estruturados do gráfico antigo (se você ainda o mantiver na tela)
      const dadosGrafico = {
        labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
        valores: [
          fluxoSemanal["Seg"], fluxoSemanal["Ter"], fluxoSemanal["Qua"],
          fluxoSemanal["Qui"], fluxoSemanal["Sex"], fluxoSemanal["Sáb"], fluxoSemanal["Dom"]
        ]
      };

      // Organiza com precisão os dados que os seus 4 novos gráficos do frontend precisam receber
      const dadosComparativoMensal = {
        semana1: [fluxoMensalSemanas["Semana 1"]["Seg"], fluxoMensalSemanas["Semana 1"]["Ter"], fluxoMensalSemanas["Semana 1"]["Qua"], fluxoMensalSemanas["Semana 1"]["Qui"], fluxoMensalSemanas["Semana 1"]["Sex"], fluxoMensalSemanas["Semana 1"]["Sáb"], fluxoMensalSemanas["Semana 1"]["Dom"]],
        semana2: [fluxoMensalSemanas["Semana 2"]["Seg"], fluxoMensalSemanas["Semana 2"]["Ter"], fluxoMensalSemanas["Semana 2"]["Qua"], fluxoMensalSemanas["Semana 2"]["Qui"], fluxoMensalSemanas["Semana 2"]["Sex"], fluxoMensalSemanas["Semana 2"]["Sáb"], fluxoMensalSemanas["Semana 2"]["Dom"]],
        semana3: [fluxoMensalSemanas["Semana 3"]["Seg"], fluxoMensalSemanas["Semana 3"]["Ter"], fluxoMensalSemanas["Semana 3"]["Qua"], fluxoMensalSemanas["Semana 3"]["Qui"], fluxoMensalSemanas["Semana 3"]["Sex"], fluxoMensalSemanas["Semana 3"]["Sáb"], fluxoMensalSemanas["Semana 3"]["Dom"]],
        semana4: [fluxoMensalSemanas["Semana 4"]["Seg"], fluxoMensalSemanas["Semana 4"]["Ter"], fluxoMensalSemanas["Semana 4"]["Qua"], fluxoMensalSemanas["Semana 4"]["Qui"], fluxoMensalSemanas["Semana 4"]["Sex"], fluxoMensalSemanas["Semana 4"]["Sáb"], fluxoMensalSemanas["Semana 4"]["Dom"]]
      };

      // 5. Renderiza a view injetando TODOS os pacotes de dados necessários
      res.render('dashboard', {
        agendamentos: rows,         // Alimenta a tabela e o card lateral
        resumoMensal: resumoMensal,  // Alimenta o calendário dinâmico
        dadosGrafico: dadosGrafico,  // Alimenta o gráfico de fluxo semanal antigo (com a vírgula corrigida! 😉)
        dadosComparativoMensal: dadosComparativoMensal // Alimenta os 4 novos gráficos por semana!
      });

    } catch (error) {
      // ESTE É O LOG QUE PRECISAMOS VER NO DOCKER SE ALGO FALHAR
      console.error('-----------------------------------------');
      console.error('ERRO REAL NO BANCO:', error.message);
      console.error('SQL STATE:', error.sqlState);
      console.error('-----------------------------------------');

      res.status(500).send('Erro interno ao buscar dados. Verifique o console do servidor.');
    }
  }
};

module.exports = dashboardController;