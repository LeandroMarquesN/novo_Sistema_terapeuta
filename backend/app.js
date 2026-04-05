require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 1. IMPORTAÇÃO DAS ROTAS ---
const pacientesRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const openAiRoutes = require('./routes/openAiRoutes');
const equipeRoutes = require('./routes/equipeRoutes'); // DECLARADO SÓ UMA VEZ!
const authRoutes = require('./routes/authRoutes');
const cadastroClinicaRoutes = require('./routes/cadastro_clinicaRoutes');

// --- 2. MAPEAMENTO DAS APIS ---
app.use('/api/auth', authRoutes);
app.use('/api/clinicas', cadastroClinicaRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/equipe', equipeRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/openai', openAiRoutes);

// --- 3. SERVIDORES DE ARQUIVOS ESTÁTICOS ---
app.use('/pages', express.static(path.join(__dirname, 'frontend', 'pages')));
app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));
app.use('/logo', express.static(path.join(__dirname, 'frontend', 'logo')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'index.html'));
});

module.exports = app;