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