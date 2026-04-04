// backend/app.js
const path = require('path');
const express = require('express');
const cors = require('cors');

// Importação das Rotas
// Certifique-se que o nome do arquivo em /routes/ é exatamente este:
const pacientesRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const openAiRoutes = require('./routes/openAiRoutes');
const equipeRoutes = require('./routes/equipeRoutes');
const cadastroClinicaRoutes = require('./routes/cadastro_clinicaRoutes');
const equipeRoutes = require('./routes/equipeRoutes');

const app = express();

// Middlewares padrão
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MAPEAMENTO DAS APIS ---

// Esta rota agora cuida de: Listar Pacientes e Ver Prontuários
app.use('/api/pacientes', pacientesRoutes);

// Esta rota cuida de: Criar, Listar, Deletar e Reagendar Consultas
app.use('/api/agendamentos', agendamentoRoutes);

// Rota de Cadastro de Clínicas (SaaS - Multi-tenant)
app.use('/api/auth', cadastroClinicaRoutes);

// Rota de Equipe (Preparando para o futuro)
app.use('/api/equipe', equipeRoutes);

app.use('/api/usuarios', usuarioRoutes);
app.use('/api/openai', openAiRoutes);
app.use('/api/equipe', equipeRoutes);

// --- SERVIDORES DE ARQUIVOS ESTÁTICOS ---

// Ajuste importante: Verifique se a pasta 'frontend' está na raiz do projeto ou dentro de 'backend'
// Se estiver na raiz, use: path.join(__dirname, '..', 'frontend', ...)

// Essa linha que adcionei para abrir  as pasta pages
app.use('/pages', express.static(path.join(__dirname, 'frontend', 'pages')));

app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));
app.use(express.static(path.join(__dirname, 'frontend', 'pages')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));
app.use('/logo', express.static(path.join(__dirname, 'frontend', 'logo')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Página inicial
// importante saber que para o index aparecer estou usando o app.get().
// 🔍 O que aconteceu (Para você nunca mais esquecer):
// O seu index.html abria porque você tinha uma chave específica para ele (a rota app.get('/')). Mas os outros arquivos da mesma pasta estavam "trancados".

// Quando você adicionou a linha:
// app.use('/pages', express.static(...))

// Você basicamente disse ao Node: "Pode abrir a porta da pasta 'pages' para todo mundo que bater nela!".
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'index.html'));
});

module.exports = app;