// services/signature/signatureFactory.js
const internalPasswordAdapter = require('./internalPasswordAdapter');
const icpBrasilAdapter = require('./icpBrasilAdapter');
const mockSignatureAdapter = require('./mockSignatureAdapter');

class SignatureFactory {
    static async assinarDocumento(usuario, documentoData, credencial) {
        // Se estiver explicitamente em ambiente de desenvolvimento/testes locais
        if (process.env.NODE_ENV === 'development' || process.env.USE_SIGNATURE_MOCK === 'true') {
            return await mockSignatureAdapter.assinar(usuario, documentoData, credencial);
        }

        // Se o cargo exige ou se o usuário configurou certificado A1/Nuvem
        const cargosComCertificadoObrigatorio = ['medico']; // Adicione outros se necessário
        const possuiCertificado = usuario.certificado_a1_blob || usuario.cloud_token_ref;

        if (cargosComCertificadoObrigatorio.includes(usuario.cargo) && possuiCertificado) {
            return await icpBrasilAdapter.assinar(usuario, documentoData, credencial);
        }

        // Padrão para psicólogos, fisioterapeutas, terapeutas, etc., ou senha interna
        return await internalPasswordAdapter.assinar(usuario, documentoData, credencial);
    }
}

module.exports = SignatureFactory;