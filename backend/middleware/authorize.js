// middlewares/authorize.js

const authorizeFinanceiro = (req, res, next) => {
  // O req.usuario foi preenchido pelo seu authMiddleware anterior
  const { cargo } = req.usuario;

  // Definimos quem pode entrar: 'dono' ou 'admin'
  const cargoAutorizados = ['dono', 'admin', 'administrador'];

  if (!cargoAutorizados.includes(cargo)) {
    return res.status(403).json({
      error: 'Acesso negado. Apenas o administrador ou o dono da clínica podem acessar o módulo financeiro.'
    });
  }

  next(); // Se for autorizado, segue para o Controller
};

module.exports = authorizeFinanceiro;


