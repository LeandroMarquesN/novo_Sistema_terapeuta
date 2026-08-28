const db = require('../config/db');
const cloudinary = require('../config/cloudinary');

const CARGOS_BLOQUEADOS = ['admin', 'recepcao'];

function podeArquivar(req) {
    const cargo = (req.usuario?.cargo || '').toLowerCase().trim();
    if (!cargo) return false;
    return !CARGOS_BLOQUEADOS.includes(cargo);
}

// ─────────────────────────────────────────────
exports.listarPacientes = async (req, res) => {
    if (!req.usuario) {
        return res.status(401).json({ erro: 'Usuário não autenticado ou token inválido' });
    }

    const clinicaId = req.usuario.clinica_id;

    try {
        const [pacientes] = await db.query(
            `SELECT *
       FROM pacientes
       WHERE clinica_id = ?
         AND (ativo = 1 OR ativo IS NULL)
       ORDER BY nome ASC`,
            [clinicaId]
        );
        res.json(pacientes);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// ─────────────────────────────────────────────
exports.listarArquivados = async (req, res) => {
    if (!req.usuario) {
        return res.status(401).json({ erro: 'Usuário não autenticado ou token inválido' });
    }

    const clinicaId = req.usuario.clinica_id;
    const somenteTotal = String(req.query.somenteTotal || '') === '1';
    const q = (req.query.q || '').trim();

    try {
        if (somenteTotal) {
            const [rows] = await db.query(
                `SELECT COUNT(*) AS total
         FROM pacientes
         WHERE clinica_id = ? AND ativo = 0`,
                [clinicaId]
            );
            return res.json({ total: rows[0]?.total || 0 });
        }

        let sql = `
      SELECT id, nome, cpf, telefone, email,
             arquivado_em, arquivado_por, motivo_arquivamento, ativo
      FROM pacientes
      WHERE clinica_id = ? AND ativo = 0
    `;
        const params = [clinicaId];

        if (q) {
            sql += ` AND (nome LIKE ? OR cpf LIKE ?)`;
            params.push(`%${q}%`, `%${q}%`);
        }

        sql += ` ORDER BY arquivado_em DESC, nome ASC`;

        const [pacientes] = await db.query(sql, params);

        return res.json({
            total: pacientes.length,
            pacientes
        });
    } catch (err) {
        console.error('Erro ao listar arquivados:', err);
        res.status(500).json({ erro: err.message });
    }
};

// ─────────────────────────────────────────────
exports.arquivarPaciente = async (req, res) => {
    if (!req.usuario) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    if (!podeArquivar(req)) {
        return res.status(403).json({
            success: false,
            message: 'Seu cargo não permite arquivar pacientes.'
        });
    }

    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;
    const motivo = (req.body?.motivo || 'Arquivado pela tela de pacientes').slice(0, 255);

    try {
        const [result] = await db.query(
            `UPDATE pacientes
       SET ativo = 0,
           arquivado_em = NOW(),
           arquivado_por = ?,
           motivo_arquivamento = ?
       WHERE id = ?
         AND clinica_id = ?
         AND (ativo = 1 OR ativo IS NULL)`,
            [req.usuario.id, motivo, id, clinicaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paciente não encontrado, já arquivado ou fora da sua clínica.'
            });
        }

        return res.json({
            success: true,
            message: 'Paciente arquivado com sucesso. O prontuário foi preservado.'
        });
    } catch (err) {
        console.error('Erro ao arquivar paciente:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Erro interno ao arquivar paciente.'
        });
    }
};

// ─────────────────────────────────────────────
exports.restaurarPaciente = async (req, res) => {
    if (!req.usuario) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    if (!podeArquivar(req)) {
        return res.status(403).json({
            success: false,
            message: 'Seu cargo não permite restaurar pacientes.'
        });
    }

    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        const [result] = await db.query(
            `UPDATE pacientes
       SET ativo = 1,
           arquivado_em = NULL,
           arquivado_por = NULL,
           motivo_arquivamento = NULL
       WHERE id = ?
         AND clinica_id = ?
         AND ativo = 0`,
            [id, clinicaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paciente não encontrado, já ativo ou fora da sua clínica.'
            });
        }

        return res.json({
            success: true,
            message: 'Paciente restaurado com sucesso.'
        });
    } catch (err) {
        console.error('Erro ao restaurar paciente:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Erro interno ao restaurar paciente.'
        });
    }
};

// ─────────────────────────────────────────────
exports.verProntuario = async (req, res) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Acesso negado' });

    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        const [paciente] = await db.query(
            'SELECT * FROM pacientes WHERE id = ? AND clinica_id = ?',
            [id, clinicaId]
        );

        if (paciente.length === 0) {
            return res.status(404).json({ msg: 'Paciente não encontrado nesta clínica' });
        }

        const [historico] = await db.query(
            `SELECT id, data_agendamento, tipo_terapia, motivo_consulta, status_agendamento
       FROM agendamentos
       WHERE paciente_id = ? AND clinica_id = ?
       ORDER BY data_agendamento DESC`,
            [id, clinicaId]
        );

        const [anexos] = await db.query(
            'SELECT * FROM anexos WHERE paciente_id = ? AND clinica_id = ?',
            [id, clinicaId]
        );

        res.json({
            dados: paciente[0],
            consultas: historico,
            arquivos: anexos
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// ─────────────────────────────────────────────
exports.obterFichaExpressa = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        const sql = `
      SELECT p.*, a.motivo_consulta, a.condicoes AS condicoes_saude
      FROM pacientes p
      LEFT JOIN agendamentos a ON p.id = a.paciente_id
      WHERE p.id = ? AND p.clinica_id = ?
      ORDER BY a.data_agendamento DESC
      LIMIT 1
    `;

        const [resultados] = await db.query(sql, [id, clinicaId]);

        if (!resultados || resultados.length === 0) {
            return res.status(404).json({ error: 'Paciente não localizado' });
        }

        res.json(resultados[0]);
    } catch (err) {
        console.error('ERRO NO BANCO:', err);
        res.status(500).json({ erro: err.message });
    }
};

// ─────────────────────────────────────────────
// Foto → Cloudinary
// ─────────────────────────────────────────────
exports.atualizarFoto = async (req, res) => {
    console.log('========== [FOTO] INÍCIO ==========');
    console.log('[FOTO] params.id:', req.params?.id);
    console.log('[FOTO] usuario.clinica_id:', req.usuario?.clinica_id);
    console.log('[FOTO] cloudinary env?', {
        cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
        api_key: !!process.env.CLOUDINARY_API_KEY,
        api_secret: !!process.env.CLOUDINARY_API_SECRET,
        cloud_name_value: process.env.CLOUDINARY_CLOUD_NAME || '(vazio)',
    });

    if (!req.usuario) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const pacienteId = req.params.id;
    const clinicaId = req.usuario.clinica_id;

    if (!clinicaId) {
        return res.status(401).json({
            success: false,
            message: 'Token sem clinica_id. Faça login novamente.',
        });
    }

    if (!req.file) {
        console.log('[FOTO] req.file vazio');
        return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }

    console.log('[FOTO] arquivo:', {
        mimetype: req.file.mimetype,
        sizeKB: Math.round((req.file.size || 0) / 1024),
    });

    try {
        const [rows] = await db.query(
            'SELECT id, foto_perfil FROM pacientes WHERE id = ? AND clinica_id = ? LIMIT 1',
            [pacienteId, clinicaId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Paciente não encontrado.' });
        }

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
                        console.error('[FOTO] Cloudinary ERRO:', err.message, err.http_code);
                        return reject(err);
                    }
                    console.log('[FOTO] Cloudinary OK:', uploaded?.secure_url);
                    resolve(uploaded);
                }
            );
            stream.end(req.file.buffer);
        });

        const urlFoto = result.secure_url;

        await db.query(
            'UPDATE pacientes SET foto_perfil = ? WHERE id = ? AND clinica_id = ?',
            [urlFoto, pacienteId, clinicaId]
        );

        console.log('[FOTO] SUCESSO');
        return res.json({
            success: true,
            message: 'Foto atualizada com sucesso.',
            foto_perfil: urlFoto,
        });
    } catch (error) {
        console.error('[FOTO] FALHA:', error?.message, error?.http_code);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Erro ao salvar a foto.',
        });
    }
};