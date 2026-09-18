// services/signature/mockSignatureAdapter.js
class MockSignatureAdapter {
    static async assinar(usuario, documentoData, credencial) {
        // Simula um atraso de rede de um serviço externo de certificação
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            sucesso: true,
            metodo: 'ICP_BRASIL_MOCK',
            mensagem: `[MOCK] Assinatura digital simulada com sucesso para ${usuario.nome} (${usuario.cargo}).`,
            hash: 'MOCK-ICP-BR-' + Date.now(),
            certificadoInfo: {
                titular: usuario.nome,
                serial: 'MOCK-SERIAL-123456789',
                validade: '2028-12-31'
            }
        };
    }
}

module.exports = MockSignatureAdapter;