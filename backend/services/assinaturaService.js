// services/assinaturaService.js
const forge = require('node-forge');

/**
 * Realiza a assinatura digital utilizando o Certificado A1 (.pfx) armazenado em buffer
 * @param {Buffer} pfxBuffer - Arquivo .pfx lido do banco de dados
 * @param {string} senha - Senha do certificado
 * @param {string|Buffer} dadosParaAssinar - Texto ou hash do documento a ser assinado
 */
exports.assinarComA1 = async (pfxBuffer, senha, dadosParaAssinar) => {
    try {
        if (!pfxBuffer) {
            throw new Error('Certificado A1 não encontrado para este profissional.');
        }

        // Converte o buffer do PFX para o formato esperado pelo node-forge
        const pfxDer = forge.util.binary.rawString.encode(pfxBuffer.toString('binary'));
        const pfxAsn1 = forge.asn1.fromDer(pfxDer);

        // Descriptografa o container PKCS#12
        const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, senha);

        let chavePrivada = null;
        let certificadoPublico = null;

        for (let safeBag of pfx.safeBags) {
            if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) {
                chavePrivada = safeBag.key;
            } else if (safeBag.type === forge.pki.oids.certBag) {
                certificadoPublico = safeBag.cert;
            }
        }

        if (!chavePrivada || !certificadoPublico) {
            throw new Error('Chave privada ou certificado público não localizados no arquivo PFX.');
        }

        // Gera o hash SHA-256 e assina com a chave privada
        const md = forge.md.sha256.create();
        md.update(typeof dadosParaAssinar === 'string' ? dadosParaAssinar : dadosParaAssinar.toString(), 'utf8');

        const signature = chavePrivada.sign(md);
        const assinaturaHex = forge.util.bytesToHex(signature);

        return {
            sucesso: true,
            assinatura: assinaturaHex,
            serialCertificado: certificadoPublico.serialNumber,
            titular: certificadoPublico.subject.getField('CN')?.value || 'Desconhecido',
            validade: certificadoPublico.validity.notAfter
        };

    } catch (error) {
        console.error('[assinaturaService] Erro ao processar A1:', error.message);
        throw new Error('Falha na assinatura digital A1: ' + error.message);
    }
};

/**
 * Integração com Autoridade Certificadora em Nuvem (Ex: SafeId / BirdID / APIs parceiras)
 */
exports.assinarComNuvem = async (cloudTokenRef, dadosParaAssinar) => {
    // Aqui entrará a chamada POST via axios para a API da AC em nuvem do médico
    // Exemplo estrutural:
    // const response = await axios.post('https://api.autoridadecertificadora.com/v1/sign', { token: cloudTokenRef, payload: dadosParaAssinar });
    // return response.data;

    throw new Error('Integração com assinatura em nuvem pendente de credenciamento com a API da AC.');
};