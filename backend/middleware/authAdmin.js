const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // 1. Pega o token do header Authorization (Bearer TOKEN)
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 2. Verifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seu_segredo_aqui');

    // 3. Valida se é o usuário master do MedLM
    // Ajustado para o novo e-mail que definimos: admin@medlm.com
    if (decoded.email === 'admin@medlm.com' && decoded.cargo === 'dono') {
      req.usuario = decoded; // Salva os dados no request para uso futuro
      return next();
    }

    return res.status(403).json({ error: "Acesso negado. Apenas para o mestre do MedLM." });

  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};