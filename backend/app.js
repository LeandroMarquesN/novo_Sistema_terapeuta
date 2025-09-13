const path = require('path');
const express = require('express');
const cors = require('cors');

const pacienteRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');

const openAiRoutes = require('./routes/openAiRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Definindo todas as rotas da API
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/usuarios', usuarioRoutes);

app.use('/api/openai', openAiRoutes);

// Servir uploads e arquivos estáticos
// Usando '..' para subir um nível e acessar as pastas na raiz do projeto
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/assets', express.static(path.join(__dirname, '..', 'frontend', 'assets')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'pages')));
app.use('/css', express.static(path.join(__dirname, '..', 'frontend', 'css')));
app.use('/logo', express.static(path.join(__dirname, '..', 'frontend', 'logo')));

// Rota para a página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'pages', 'index.html'));
});

module.exports = app;
