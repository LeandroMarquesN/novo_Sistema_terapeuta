const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // 1. Pega o token que vem no cabeçalho da requisição
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ error: "Acesso negado. Faça login para continuar." });
    }

    try {
        // 2. Verifica se o token é válido usando a sua JWT_SECRET do .env
        const verificado = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Adiciona os dados do usuário na requisição para os próximos controllers usarem
        req.usuario = verificado;

        next(); // Pode seguir para a rota!
    } catch (err) {
        res.status(403).json({ error: "Token inválido ou expirado." });
    }
};