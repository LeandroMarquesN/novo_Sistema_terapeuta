const db = require('../config/db');
const { getUrlDocumentoR2 } = require('../services/documentosService');

exports.listarDocumentosPaciente = async (req, res) => {
    const { pacienteId } = req.params;
    const clinicaId = req.usuario?.clinica_id;

    if (!pacienteId || !clinicaId) {
        return res.status(400).json({ erro: 'Parâmetros inválidos.' });
    }

    try {
        const [docs] = await db.query(
            `SELECT id, nome_original, mime_type, tamanho_bytes, storage_key, criado_em
       FROM paciente_documentos
       WHERE paciente_id = ? AND clinica_id = ?
       ORDER BY criado_em DESC`,
            [pacienteId, clinicaId]
        );

        const documentosComUrl = await Promise.all(
            docs.map(async (doc) => {
                try {
                    const url = await getUrlDocumentoR2(doc.storage_key);
                    return { ...doc, url };
                } catch (err) {
                    console.error('Erro ao gerar URL assinada:', err);
                    return { ...doc, url: null };
                }
            })
        );

        res.json(documentosComUrl);
    } catch (error) {
        console.error('Erro ao listar documentos:', error);
        res.status(500).json({ erro: 'Erro ao buscar documentos.' });
    }
};