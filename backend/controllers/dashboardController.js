const db = require('../config/db');

const dashboardController = {
  index: async (req, res) => {
    try {
      // 1. Log de controle do Token
      console.log("DEBUG: Dados do usuário no token:", req.usuario);

      if (!req.usuario || !req.usuario.clinica_id) {
        console.error("ERRO: clinica_id não encontrado no token!");
        return res.status(403).send("Erro de identificação da clínica. Faça login novamente.");
      }

      const clinicaId = req.usuario.clinica_id;

      // 2. CAPTURA O FILTRO DA URL (Se não for passado, o padrão é exibir o 'dia' de hoje)
      const filtro = req.query.filtro || 'dia';
      console.log(`DEBUG: Filtro de listagem ativo na tabela: [${filtro}]`);

      // 3. DEFINE A REGRA SQL ADICIONAL BASEADA NO BOTÃO CLICADO
      let filtroSql = '';
      if (filtro === 'dia') {
        filtroSql = 'AND DATE(data_agendamento) = CURDATE()';
      } else if (filtro === 'semana') {
        filtroSql = 'AND YEARWEEK(data_agendamento, 1) = YEARWEEK(CURDATE(), 1)';
      } else if (filtro === 'mes') {
        filtroSql = 'AND MONTH(data_agendamento) = MONTH(CURDATE()) AND YEAR(data_agendamento) = YEAR(CURDATE())';
      } else if (filtro === 'ano') {
        filtroSql = 'AND YEAR(data_agendamento) = YEAR(CURDATE())';
      }

      // 4. QUERY 1: Busca APENAS os agendamentos filtrados para não inflar a tabela
      const queryTabela = `
                SELECT id, nome, data_agendamento, status_agendamento, tipo_terapia, telefone
                FROM agendamentos
                WHERE clinica_id = ? ${filtroSql}
                ORDER BY data_agendamento DESC
            `;

      // 5. QUERY 2: Busca TODOS os dados do mês atual para os gráficos e calendário continuarem cheios
      const queryMetricasGerais = `
                SELECT id, nome, data_agendamento, status_agendamento, tipo_terapia, telefone
                FROM agendamentos
                WHERE clinica_id = ?
                AND MONTH(data_agendamento) = MONTH(CURDATE())
                AND YEAR(data_agendamento) = YEAR(CURDATE())
            `;

      // Executa as duas buscas em paralelo no MySQL (ganho de performance)
      const [[rowsTabela], [rowsMetricas]] = await Promise.all([
        db.execute(queryTabela, [clinicaId]),
        db.execute(queryMetricasGerais, [clinicaId])
      ]);

      console.log(`SUCESSO: ${rowsTabela.length} agendamentos renderizados na tabela.`);
      console.log(`METRICAS: ${rowsMetricas.length} registros processados para os gráficos.`);

      // 6. ESTRUTURAS DE GRÁFICOS E CALENDÁRIO
      const resumoMensal = {};
      const fluxoSemanal = { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 };
      const diasNome = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      const fluxoMensalSemanas = {
        "Semana 1": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 },
        "Semana 2": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 },
        "Semana 3": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 },
        "Semana 4": { "Seg": 0, "Ter": 0, "Qua": 0, "Qui": 0, "Sex": 0, "Sáb": 0, "Dom": 0 }
      };

      // 7. LOOP DE PROCESSAMENTO (Usa rowsMetricas para alimentar os componentes visuais)
      rowsMetricas.forEach(agend => {
        const dataObj = new Date(agend.data_agendamento);
        const diaReal = dataObj.getDate();

        if (agend.status_agendamento !== 'cancelado') {
          // Calendário
          const horaMinuto = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          if (!resumoMensal[diaReal]) {
            resumoMensal[diaReal] = { total: 0, horarios: [] };
          }
          resumoMensal[diaReal].total += 1;
          resumoMensal[diaReal].horarios.push(horaMinuto);

          // Gráfico Geral
          const diaSemanaNome = diasNome[dataObj.getDay()];
          if (fluxoSemanal[diaSemanaNome] !== undefined) {
            fluxoSemanal[diaSemanaNome] += 1;
          }

          // Divisão das 4 Semanas do Mês
          let numeroSemana = Math.ceil(diaReal / 7);
          if (numeroSemana > 4) numeroSemana = 4;

          const labelSemana = `Semana ${numeroSemana}`;
          // Correção definitiva aplicada aqui (fluxoMensalSemanas com o "o")
          if (fluxoMensalSemanas[labelSemana] && fluxoMensalSemanas[labelSemana][diaSemanaNome] !== undefined) {
            fluxoMensalSemanas[labelSemana][diaSemanaNome] += 1;
          }
        }
      });

      // Formata horários do calendário
      Object.keys(resumoMensal).forEach(dia => {
        resumoMensal[dia].horarios = resumoMensal[dia].horarios.join(', ');
      });

      const dadosGrafico = {
        labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
        valores: [
          fluxoSemanal["Seg"], fluxoSemanal["Ter"], fluxoSemanal["Qua"],
          fluxoSemanal["Qui"], fluxoSemanal["Sex"], fluxoSemanal["Sáb"], fluxoSemanal["Dom"]
        ]
      };

      const dadosComparativoMensal = {
        semana1: [fluxoMensalSemanas["Semana 1"]["Seg"], fluxoMensalSemanas["Semana 1"]["Ter"], fluxoMensalSemanas["Semana 1"]["Qua"], fluxoMensalSemanas["Semana 1"]["Qui"], fluxoMensalSemanas["Semana 1"]["Sex"], fluxoMensalSemanas["Semana 1"]["Sáb"], fluxoMensalSemanas["Semana 1"]["Dom"]],
        semana2: [fluxoMensalSemanas["Semana 2"]["Seg"], fluxoMensalSemanas["Semana 2"]["Ter"], fluxoMensalSemanas["Semana 2"]["Qua"], fluxoMensalSemanas["Semana 2"]["Qui"], fluxoMensalSemanas["Semana 2"]["Sex"], fluxoMensalSemanas["Semana 2"]["Sáb"], fluxoMensalSemanas["Semana 2"]["Dom"]],
        semana3: [fluxoMensalSemanas["Semana 3"]["Seg"], fluxoMensalSemanas["Semana 3"]["Ter"], fluxoMensalSemanas["Semana 3"]["Qua"], fluxoMensalSemanas["Semana 3"]["Qui"], fluxoMensalSemanas["Semana 3"]["Sex"], fluxoMensalSemanas["Semana 3"]["Sáb"], fluxoMensalSemanas["Semana 3"]["Dom"]],
        semana4: [fluxoMensalSemanas["Semana 4"]["Seg"], fluxoMensalSemanas["Semana 4"]["Ter"], fluxoMensalSemanas["Semana 4"]["Qua"], fluxoMensalSemanas["Semana 4"]["Qui"], fluxoMensalSemanas["Semana 4"]["Sex"], fluxoMensalSemanas["Semana 4"]["Sáb"], fluxoMensalSemanas["Semana 4"]["Dom"]]
      };

      // 8. INTELIGÊNCIA AJAX: Se a requisição pedir JSON, devolvemos apenas a tabela filtrada
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.json({
          agendamentos: rowsTabela,
          filtroAtivo: filtro
        });
      }

      // Se for o acesso normal à página, renderiza o HTML completo do EJS
      res.render('dashboard', {
        agendamentos: rowsTabela,
        filtroAtivo: filtro,
        resumoMensal: resumoMensal,
        dadosGrafico: dadosGrafico,
        dadosComparativoMensal: dadosComparativoMensal
      });

    } catch (error) {
      console.error('-----------------------------------------');
      console.error('ERRO REAL NO BANCO:', error.message);
      console.error('SQL STATE:', error.sqlState);
      console.error('-----------------------------------------');
      res.status(500).send('Erro interno ao carregar o painel estratégico.');
    }
  }
};

module.exports = dashboardController;