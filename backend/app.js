// backend/app.js

const path = require('path');
const express = require('express');
const cors = require('cors');

const pacienteRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();

// Libera CORS
app.use(cors());

// Permite JSON no corpo das requisições
app.use(express.json());

// Rotas da API
app.use('/api', pacienteRoutes);
app.use('/api/usuarios', usuarioRoutes);

// Servir arquivos estáticos
app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));

app.use(express.static(path.join(__dirname, 'frontend', 'pages')));

// Rota principal (redireciona para index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'index.html'));
});


module.exports = app;
