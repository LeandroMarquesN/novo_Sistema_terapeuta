const db = require('../config/db');

// Listar todos os pacientes da clínica (para a tabela principal)
exports.listarPacientes = async (req, res) => {
    const clinicaId = 1; // Simulação SaaS
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
    const { id } = req.params;
    const clinicaId = 1;

    try {
        // 1. Dados do Paciente
        const [paciente] = await db.query(
            'SELECT * FROM pacientes WHERE id = ? AND clinica_id = ?',
            [id, clinicaId]
        );

        if (paciente.length === 0) return res.status(404).json({ msg: "Paciente não encontrado" });

        // 2. Histórico de Consultas
        const [historico] = await db.query(
            'SELECT id, data_agendamento, tipo_terapia, motivo_consulta, status_agendamento FROM agendamentos WHERE paciente_id = ? ORDER BY data_agendamento DESC',
            [id]
        );

        // 3. Todos os Anexos do Paciente
        const [anexos] = await db.query(
            'SELECT * FROM anexos WHERE paciente_id = ?',
            [id]
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