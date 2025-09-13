// backend/app.js

const path = require('path');
const express = require('express');
const cors = require('cors');

const pacienteRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');
<<<<<<< HEAD
const exameRoutes = require('./exames/routes/exameRoutes');
=======
const openAiRoutes = require('./routes/openAiRoutes'); // <-- Nova linha
>>>>>>> 3959620b0900f06c3eea4d8f921ebede1266b5c5

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/agendamentos', agendamentoRoutes);
<<<<<<< HEAD
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/exames', exameRoutes);


// Servir uploads (caminho corrigido)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Servir arquivos estáticos (caminhos corrigidos)
// O erro estava aqui. Os caminhos foram corrigidos para subir um nível ('..')
// e acessar as pastas 'frontend' e 'uploads' que estão na raiz do projeto.
app.use('/assets', express.static(path.join(__dirname, '..', 'frontend', 'assets')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'pages')));
app.use('/css', express.static(path.join(__dirname, '..', 'frontend', 'css')));

// Nova linha para servir a pasta 'logo' (caminho corrigido)
app.use('/logo', express.static(path.join(__dirname, '..', 'frontend', 'logo')));



// Página inicial (caminho corrigido)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'pages', 'index.html'));
});

module.exports = app;
=======
app.use('/api/pacientes', pacienteRoutes); // <<-- Rota corrigida
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/openai', openAiRoutes); // <-- Nova linha

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
>>>>>>> 3959620b0900f06c3eea4d8f921ebede1266b5c5
