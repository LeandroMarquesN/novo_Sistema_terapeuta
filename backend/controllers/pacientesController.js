// ─────────────────────────────────────────────
// Atualizar foto do paciente (Cloudinary)
// PATCH /api/pacientes/:id/foto
// campo do form-data: "foto"
// ─────────────────────────────────────────────
exports.atualizarFoto = async (req, res) => {
    console.log('========== [FOTO] INÍCIO ==========');
    console.log('[FOTO] hora:', new Date().toISOString());
    console.log('[FOTO] params.id:', req.params?.id);
    console.log('[FOTO] usuario existe?', !!req.usuario);
    console.log('[FOTO] usuario.id:', req.usuario?.id);
    console.log('[FOTO] usuario.clinica_id:', req.usuario?.clinica_id);
    console.log('[FOTO] content-type:', req.headers['content-type']);
    console.log('[FOTO] cloudinary env?', {
        cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
        api_key: !!process.env.CLOUDINARY_API_KEY,
        api_secret: !!process.env.CLOUDINARY_API_SECRET,
        cloud_name_value: process.env.CLOUDINARY_CLOUD_NAME || '(vazio)',
    });

    if (!req.usuario) {
        console.log('[FOTO] BLOQUEADO: sem req.usuario (401)');
        return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const pacienteId = req.params.id;
    const clinicaId = req.usuario.clinica_id;

    if (!clinicaId) {
        console.log('[FOTO] BLOQUEADO: clinica_id ausente no token');
        return res.status(401).json({
            success: false,
            message: 'Token sem clinica_id. Faça login novamente.',
        });
    }

    if (!req.file) {
        console.log('[FOTO] BLOQUEADO: req.file está vazio (multer não recebeu "foto")');
        console.log('[FOTO] body keys:', Object.keys(req.body || {}));
        return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }

    console.log('[FOTO] arquivo recebido:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        sizeKB: Math.round((req.file.size || 0) / 1024),
        bufferLength: req.file.buffer?.length,
    });

    try {
        console.log('[FOTO] buscando paciente no banco...', { pacienteId, clinicaId });

        const [rows] = await db.query(
            'SELECT id, foto_perfil FROM pacientes WHERE id = ? AND clinica_id = ? LIMIT 1',
            [pacienteId, clinicaId]
        );

        console.log('[FOTO] pacientes encontrados:', rows.length);

        if (rows.length === 0) {
            console.log('[FOTO] BLOQUEADO: paciente não encontrado para essa clínica');
            return res.status(404).json({ success: false, message: 'Paciente não encontrado.' });
        }

        console.log('[FOTO] iniciando upload Cloudinary...');

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: `medlm/pacientes/${clinicaId}`,
                    public_id: `paciente_${pacienteId}`,
                    overwrite: true,
                    transformation: [
                        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                        { quality: 'auto', fetch_format: 'auto' },
                    ],
                },
                (err, uploaded) => {
                    if (err) {
                        console.error('[FOTO] Cloudinary callback ERRO:', {
                            message: err.message,
                            name: err.name,
                            http_code: err.http_code,
                        });
                        return reject(err);
                    }
                    console.log('[FOTO] Cloudinary OK:', {
                        public_id: uploaded?.public_id,
                        secure_url: uploaded?.secure_url,
                        bytes: uploaded?.bytes,
                        format: uploaded?.format,
                    });
                    resolve(uploaded);
                }
            );
            stream.end(req.file.buffer);
        });

        const urlFoto = result.secure_url;
        console.log('[FOTO] salvando URL no banco:', urlFoto);

        await db.query(
            'UPDATE pacientes SET foto_perfil = ? WHERE id = ? AND clinica_id = ?',
            [urlFoto, pacienteId, clinicaId]
        );

        console.log('[FOTO] SUCESSO — foto salva');
        console.log('========== [FOTO] FIM OK ==========');

        return res.json({
            success: true,
            message: 'Foto atualizada com sucesso.',
            foto_perfil: urlFoto,
        });
    } catch (error) {
        console.error('========== [FOTO] FALHA ==========');
        console.error('[FOTO] message:', error?.message);
        console.error('[FOTO] name:', error?.name);
        console.error('[FOTO] http_code:', error?.http_code);
        console.error('[FOTO] stack:', error?.stack);
        console.error('========== [FOTO] FIM ERRO ==========');

        return res.status(500).json({
            success: false,
            // mensagem real para o celular também mostrar
            message: error?.message || 'Erro ao salvar a foto.',
        });
    }
};