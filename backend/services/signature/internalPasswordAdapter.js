// services/signature/internalPasswordAdapter.js
const bcrypt = require('bcrypt');

class InternalPasswordAdapter {
    static async assinar(usuario, documentoData, senhaInformada) {
        if (!senhaInformada) {
            throw new Error('A senha interna é obrigatória para validar este documento.');
        }

        // Valida a senha do usuário
        const senhaValida = await bcrypt.compare(senhaInformada, usuario.senha);
        if (!senhaValida) {
            throw new Error('Senha interna incorreta.');
        }

        return {
            sucesso: true,
            metodo: 'SENHA_INTERNA',
            mensagem: 'Documento validado e assinado com senha interna com sucesso.',
            hash: 'INT-' + Date.now() + '-' + Math.random().toString(36.substring(2))
        };
    }
}

module.exports = InternalPasswordAdapter;