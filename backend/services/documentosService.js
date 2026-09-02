const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/r2');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const URL_EXPIRACAO_SEGUNDOS = 60 * 10; // 10 minutos — tempo suficiente para abrir/carregar o visualizador

/**
 * Envia um arquivo para o Cloudflare R2
 */
async function uploadDocumentoToR2(file, pacienteId) {
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replace(/\s+/g, '_');
    const storageKey = `pacientes/${pacienteId}/${timestamp}-${sanitizedOriginalName}`;

    const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    return {
        storageKey,
        nomeOriginal: file.originalname,
        mimetype: file.mimetype,
        tamanho: file.size,
    };
}

/**
 * Gera uma URL assinada temporária para leitura de um documento privado do R2
 * @param {String} storageKey - Chave do objeto no bucket
 * @param {Number} expiraEmSegundos - Validade do link (padrão 10 min)
 */
async function getUrlDocumentoR2(storageKey, expiraEmSegundos = URL_EXPIRACAO_SEGUNDOS) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
    });

    return getSignedUrl(s3Client, command, { expiresIn: expiraEmSegundos });
}

module.exports = { uploadDocumentoToR2, getUrlDocumentoR2 };