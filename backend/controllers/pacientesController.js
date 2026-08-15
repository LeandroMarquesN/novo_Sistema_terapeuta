const db = require('../config/db');

// Listar todos os pacientes da clínica (para a tabela principal)
exports.listarPacientes = async (req, res) => {
    // 1. Trava de segurança: impede o erro "undefined"
    if (!req.usuario) {
        return res.status(401).json({ erro: "Usuário não autenticado ou token inválido" });
    }

    const clinicaId = req.usuario.clinica_id;

    try {
        const [pacientes] = await db.query(
            'SELECT * FROM pacientes WHERE clinica_id = ? ORDER BY nome ASC',
            [clinicaId]
        );
        res.json(pacientes);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// Ver prontuário completo (Dados + Consultas + Anexos)
exports.verProntuario = async (req, res) => {
    if (!req.usuario) return res.status(401).json({ erro: "Acesso negado" });

    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        // 1. Dados do Paciente (Aqui garantimos que ele pertence à clínica logada)
        const [paciente] = await db.query(
            'SELECT * FROM pacientes WHERE id = ? AND clinica_id = ?',
            [id, clinicaId]
        );

        if (paciente.length === 0) {
            return res.status(404).json({ msg: "Paciente não encontrado nesta clínica" });
        }

        // 2. Histórico de Consultas (Adicionamos clinica_id por segurança extra)
        const [historico] = await db.query(
            'SELECT id, data_agendamento, tipo_terapia, motivo_consulta, status_agendamento FROM agendamentos WHERE paciente_id = ? AND clinica_id = ? ORDER BY data_agendamento DESC',
            [id, clinicaId]
        );

        // 3. Todos os Anexos do Paciente (Adicionamos clinica_id por segurança extra)
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

exports.obterFichaExpressa = async (req, res) => {
    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        // Buscamos os dados da tabela pacientes E pegamos o último motivo/condição do agendamento
        const sql = `
            SELECT p.*, a.motivo_consulta, a.condicoes as condicoes_saude
            FROM pacientes p
            LEFT JOIN agendamentos a ON p.id = a.paciente_id
            WHERE p.id = ? AND p.clinica_id = ?
            ORDER BY a.data_agendamento DESC
            LIMIT 1
        `;

        const [resultados] = await db.query(sql, [id, clinicaId]);

        if (!resultados || resultados.length === 0) {
            return res.status(404).json({ error: "Paciente não localizado" });
        }

        res.json(resultados[0]);
    } catch (err) {
        console.error("ERRO NO BANCO:", err);
        res.status(500).json({ erro: err.message });
    }
};

// Excluir paciente da clínica
exports.deletarPaciente = async (req, res) => {
    if (!req.usuario) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado ou token inválido' });
    }

    const { id } = req.params;
    const clinicaId = req.usuario.clinica_id;

    try {
        // Só exclui se o paciente pertencer à clínica do usuário logado
        const [result] = await db.query(
            'DELETE FROM pacientes WHERE id = ? AND clinica_id = ?',
            [id, clinicaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paciente não encontrado ou não pertence à sua clínica.'
            });
        }

        return res.json({
            success: true,
            message: 'Paciente excluído com sucesso.'
        });
    } catch (err) {
        console.error('Erro ao excluir paciente:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Erro interno ao excluir paciente.'
        });
    }
};