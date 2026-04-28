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

      // 2. Query simplificada para teste (se funcionar, o erro é em algum nome de coluna)
      const query = `
                SELECT id, nome, data_agendamento, status_agendamento, tipo_terapia, telefone
                FROM agendamentos
                WHERE clinica_id = ?
                ORDER BY data_agendamento DESC
            `;

      const [rows] = await db.execute(query, [clinicaId]);

      console.log(`SUCESSO: ${rows.length} agendamentos encontrados.`);

      res.render('dashboard', { agendamentos: rows });

    } catch (error) {
      // ESTE É O LOG QUE PRECISAMOS VER NO DOCKER
      console.error('-----------------------------------------');
      console.error('ERRO REAL NO BANCO:', error.message);
      console.error('SQL STATE:', error.sqlState);
      console.error('-----------------------------------------');

      res.status(500).send('Erro interno ao buscar dados. Verifique o console do servidor.');
    }
  }
};

module.exports = dashboardController;