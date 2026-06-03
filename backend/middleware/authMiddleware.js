const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Tenta pegar o token do Header OU do Cookie
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // Se não achou no header, busca no cookie
    if (!token && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});
        token = cookies.token;
    }

    if (!token) {
        // Se for uma rota de API, manda JSON. Se for página, redireciona pro login.
        if (req.path.includes('/api/')) {
            return res.status(401).json({ error: "Acesso negado." });
        }
        return res.redirect('/login');
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = verificado;
        next();
    } catch (err) {
        res.redirect('/login');
    }
};