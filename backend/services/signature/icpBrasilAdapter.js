// services/signature/icpBrasilAdapter.js
class IcpBrasilAdapter {
    static async assinar(usuario, documentoData, credencial) {
        // Aqui entrará a lógica real de criptografia com o .pfx (usuario.certificado_a1_blob)
        // ou chamada à API de assinatura em nuvem (usuario.cloud_token_ref).

        throw new Error('Integração ICP-Brasil real ainda não configurada neste ambiente.');
    }
}

module.exports = IcpBrasilAdapter;