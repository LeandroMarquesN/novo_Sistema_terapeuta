const db = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const notificationService = require('../services/notificationService'); // 👈 Importado

// URL base vinda do ambiente ou padrão do render/localhost
const APP_BASE_URL = process.env.APP_BASE_URL_ENV || "http://localhost:3000";

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }

    try {
        // Busca o usuário e a clínica correspondente (garantindo o isolamento multi-tenant)
        const [users] = await db.execute(
            'SELECT u.*, c.nome_clinica FROM usuarios u LEFT JOIN clinicas c ON u.clinica_id = c.id WHERE u.email = ?',
            [email]
        );

        // Por segurança, retornamos a mesma resposta genérica mesmo se o e-mail não existir
        if (users.length === 0) {
            return res.json({ message: 'Se o e-mail estiver cadastrado, você receberá as instruções.' });
        }

        const user = users[0];

        // Gera o token seguro e expiração de 15 minutos
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

        // Salva na tabela de usuários
        await db.execute(
            'UPDATE usuarios SET reset_token = ?, reset_expires = ? WHERE id = ?',
            [resetToken, resetExpires, user.id]
        );

        // Monta o link apontando para a página de redefinição no front-end
        const resetUrl = `${APP_BASE_URL}/pages/reset-password.html?token=${resetToken}`;

        // 📧 Dispara o e-mail utilizando o notificationService
        await notificationService.sendPasswordResetEmail(user, resetUrl);

        return res.json({ message: 'Se o e-mail estiver cadastrado, você receberá as instruções.' });
    } catch (error) {
        console.error('Erro no forgot-password:', error);
        res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
    }
};

exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }

    try {
        const [users] = await db.execute(
            'SELECT * FROM usuarios WHERE reset_token = ? AND reset_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Token inválido ou expirado.' });
        }

        const user = users[0];
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.execute(
            'UPDATE usuarios SET senha = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        return res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
    } catch (error) {
        console.error('Erro no reset-password:', error);
        res.status(500).json({ error: 'Erro ao redefinir a senha.' });
    }
};