// backend/app.js

const path = require('path');
const express = require('express');
const cors = require('cors');

const pacienteRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/pacientes', pacienteRoutes); // <<-- Rota corrigida
app.use('/api/usuarios', usuarioRoutes);

// Servir arquivos estáticos
app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));
app.use(express.static(path.join(__dirname, 'frontend', 'pages')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));

// Nova linha para servir a pasta 'logo'
app.use('/logo', express.static(path.join(__dirname, 'frontend', 'logo')));

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'index.html'));
});

module.exports = app;