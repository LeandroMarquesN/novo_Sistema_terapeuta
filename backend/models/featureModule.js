// Importe sua conexão com o banco aqui (ajuste o caminho se necessário)
const db = require('../config/db');

const featureModule = {
  checkFeature: async (clinicaId, featureNome) => {
    const query = `
            SELECT
                COALESCE(cf.is_enabled, pf.is_enabled, false) AS liberado
            FROM features f
            JOIN planos p ON p.id = (SELECT plano_id FROM clinicas WHERE id = ?)
            JOIN plano_features pf ON pf.plano_id = p.id AND pf.feature_id = f.id
            LEFT JOIN clinica_features cf ON cf.clinica_id = ? AND cf.feature_id = f.id
            WHERE f.nome_tecnico = ?
            LIMIT 1;
        `;

    try {
      const [rows] = await db.execute(query, [clinicaId, clinicaId, featureNome]);
      if (rows.length === 0) return false;
      return rows[0].liberado === 1;
    } catch (error) {
      console.error("Erro ao checar feature:", error);
      return false;
    }
  }
};

module.exports = featureModule;