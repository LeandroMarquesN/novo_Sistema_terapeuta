// Importe sua conexão com o banco aqui (ajuste o caminho se necessário)
const db = require('../config/db');

const featureModule = {
  checkFeature: async (clinicaId, featureNome) => {
    const query = `
      SELECT
          COALESCE(cf.is_enabled, pf.is_enabled, false) AS liberado
      FROM features f
      -- Buscamos o plano da clínica de forma dinâmica
      LEFT JOIN clinicas c ON c.id = ?
      -- Vinculamos os recursos padrão daquele plano (se existirem)
      LEFT JOIN plano_features pf ON pf.plano_id = c.plano_id AND pf.feature_id = f.id
      -- Vinculamos a exceção da clínica específica (se existir)
      LEFT JOIN clinica_features cf ON cf.clinica_id = c.id AND cf.feature_id = f.id
      WHERE f.nome_tecnico = ?
      LIMIT 1;
    `;

    try {
      // Passamos os parâmetros na ordem da query: clinicaId, depois o nome da feature
      const [rows] = await db.execute(query, [clinicaId, featureNome]);

      if (rows.length === 0) return false;

      // O MySQL retorna o booleano como 1 ou 0. Forçamos o retorno como true/false puro do JS
      return rows[0].liberado === 1 || rows[0].liberado === true;
    } catch (error) {
      console.error("Erro ao checar feature:", error);
      return false;
    }
  }
};

module.exports = featureModule;