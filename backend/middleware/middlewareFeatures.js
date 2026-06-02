const { checkFeature } = require('../models/featureModule');

const authorizeFeature = (featureNome) => {
  return async (req, res, next) => {
    // 🌟 AQUI ESTÁ A MÁGICA:
    // Usamos 'clinica_id' (com underline) para bater com o que seu sistema já usa
    const clinicaId = req.usuario ? req.usuario.clinica_id : null;

    if (!clinicaId) {
      return res.status(401).json({ error: 'Clínica não identificada no token.' });
    }

    // Chama o módulo com o ID que o seu sistema espera
    const temAcesso = await checkFeature(clinicaId, featureNome);

    if (!temAcesso) {
      return res.status(403).json({
        error: `Acesso negado. A funcionalidade '${featureNome}' não está disponível para o seu plano.`
      });
    }

    next();
  };
};

module.exports = { authorizeFeature };