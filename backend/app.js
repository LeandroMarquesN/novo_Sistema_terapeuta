require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const cadastroClinicaRoutes = require('./routes/cadastro_clinicaRoutes');
const equipeRoutes = require('./routes/equipeRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');

const pacienteRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes')
const openAiRoutes = require('./routes/openAiRoutes'); // <-- Nova linha

const app = express();

// --- CONFIGURAÇÃO DO EJS (Coloque logo aqui no início) ---
app.set('view engine', 'ejs');
// Se o Docker der erro de "view not found", mude para path.join(__dirname, 'frontend', 'views')
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));

// Middlewares padrão
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... (suas importações de rotas)

// --- MAPEAMENTO DAS APIS ---
app.use('/api/auth', authRoutes);
app.use('/api/clinicas', cadastroClinicaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/equipe', equipeRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/openai', openAiRoutes);
app.use('/api/financeiro', financeiroRoutes);

// --- MAPEAMENTO DAS VIEWS (Dashboard) ---
// Importante: coloque o app.use do dashboardRoutes AQUI
app.use('/', dashboardRoutes);

// --- LOGO ABAIXO DE app.set('view engine', 'ejs'); ---
// Mantive o seu caminho original que você disse que funciona
app.set('views', path.join(__dirname, 'frontend', 'views'));

// ADICIONE AQUI: Middleware para desativar o cache e proteger os dados da clínica
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// --- 2. MAPEAMENTO DAS APIS ---
app.use('/api/auth', authRoutes);

app.use('/api/clinicas', cadastroClinicaRoutes);

app.use('/api/pacientes', pacienteRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/equipe', equipeRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/openai', openAiRoutes);
// Define o prefixo das rotas financeiras
app.use('/api/financeiro', financeiroRoutes);

// rotas views --
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));

// --- 3. SERVIDORES DE ARQUIVOS ESTÁTICOS ---
app.use('/pages', express.static(path.join(__dirname, 'frontend', 'pages')));
app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));
app.use('/logo', express.static(path.join(__dirname, 'frontend', 'logo')));



// Se a pasta ScriptGlobal está dentro de frontend
app.use('/ScriptGlobal', express.static(path.join(__dirname, 'frontend/ScriptGlobal')));

// 1. Servir os arquivos estáticos da pasta frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Rota Completa (Fallback/Apelido)


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'index.html'));
});

// ADICIONE ESTA LINHA AQUI:
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'login.html'));
});

// ADICIONE ESTA ROTA AQUI:
// app.get('/dashboard', (req, res) => {
//   res.sendFile(path.join(__dirname, 'frontend', 'pages', 'dashboard.html'));
// });

app.get('/agendamento', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'agendamento.html'));
});
app.get('/pacientes', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'pacientes.html'));
});
app.get('/equipe', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'equipe.html'));
});
app.get('/financeiro', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'financeiro.html'));
});





module.exports = app;