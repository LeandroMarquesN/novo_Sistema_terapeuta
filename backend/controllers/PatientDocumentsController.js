const { uploadDocumentoToR2, getUrlDocumentoR2 } = require('../services/documentosService');
const db = require('../config/db');

class PatientDocumentsController {

    /**
     * Faz o upload de um novo documento/exame para o Cloudflare R2 e salva os metadados no MySQL
     */
    async uploadDocumento(req, res) {
        try {
            if (!req.usuario) {
                return res.status(401).json({ success: false, message: 'Não autenticado' });
            }

            const clinicaId = req.usuario.clinica_id;
            const { paciente_id } = req.body;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
            }
            if (!paciente_id) {
                return res.status(400).json({ success: false, message: 'O campo paciente_id é obrigatório.' });
            }

            // Confirma que o paciente pertence à clínica do usuário logado
            // antes de qualquer upload — evita gravar documento fora do tenant
            const [pacienteRows] = await db.query(
                'SELECT id FROM pacientes WHERE id = ? AND clinica_id = ?',
                [paciente_id, clinicaId]
            );
            if (pacienteRows.length === 0) {
                return res.status(404).json({ success: false, message: 'Paciente não encontrado nesta clínica.' });
            }

            const documentoR2 = await uploadDocumentoToR2(file, paciente_id);

            const query = `
                INSERT INTO paciente_documentos
                (clinica_id, paciente_id, nome_original, storage_key, mime_type, tamanho_bytes)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            const [result] = await db.execute(query, [
                clinicaId,
                paciente_id,
                documentoR2.nomeOriginal,
                documentoR2.storageKey,
                documentoR2.mimetype,
                documentoR2.tamanho
            ]);

            return res.status(201).json({
                success: true,
                message: 'Documento enviado e salvo com sucesso!',
                data: {
                    id: result.insertId,
                    nomeOriginal: documentoR2.nomeOriginal,
                    tamanho: documentoR2.tamanho,
                    criadoEm: new Date()
                }
            });

        } catch (error) {
            console.error('Erro ao processar o upload do documento:', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao salvar o documento.' });
        }
    }

    /**
     * Lista os documentos/exames de um paciente, cada um já com URL assinada de leitura
     */
    async listarDocumentos(req, res) {
        try {
            if (!req.usuario) {
                return res.status(401).json({ success: false, message: 'Não autenticado' });
            }

            const { pacienteId } = req.params;
            const clinicaId = req.usuario.clinica_id;

            const [documentos] = await db.query(
                `SELECT id, nome_original, storage_key, mime_type, tamanho_bytes, criado_em
                 FROM paciente_documentos
                 WHERE paciente_id = ? AND clinica_id = ?
                 ORDER BY criado_em DESC`,
                [pacienteId, clinicaId]
            );

            const documentosComUrl = await Promise.all(
                documentos.map(async (doc) => ({
                    ...doc,
                    url: await getUrlDocumentoR2(doc.storage_key)
                }))
            );

            return res.json({ success: true, documentos: documentosComUrl });
        } catch (error) {
            console.error('Erro ao listar documentos:', error);
            return res.status(500).json({ success: false, message: 'Erro ao listar documentos.' });
        }
    }
}

module.exports = new PatientDocumentsController();