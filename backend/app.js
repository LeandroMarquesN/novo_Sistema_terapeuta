require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

// Importação das Rotas
const authRoutes = require('./routes/authRoutes');
const cadastroClinicaRoutes = require('./routes/cadastro_clinicaRoutes');
const equipeRoutes = require('./routes/equipeRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const configuracaoRoutes = require('./routes/configuracaoRoutes');
const portalRoutes = require('./routes/portal-agendamento-routes');
const openAiRoutes = require('./routes/openAiRoutes');
const adminRoutes = require('./routes/adminRoutes'); // Rotas de API do Admin

// importação Middleware
const authAdmin = require('./middleware/authAdmin'); // Middleware de proteção
const authMiddleware = require('./middleware/authMiddleware')

const app = express();

// --- CONFIGURAÇÃO DO EJS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));

// Middlewares padrão
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para desativar o cache (Segurança)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});


// ...

// --- MAPEAMENTO DAS APIS ---
app.use('/api/auth', authRoutes);
app.use('/api/clinicas', cadastroClinicaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/equipe', equipeRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/openai', openAiRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/config', configuracaoRoutes);
app.use('/agendar', portalRoutes);

// --- API ADMINISTRATIVA (MedLM Master) ---
// Note que usamos o authAdmin aqui para proteger os dados do financeiro master
app.use('/api/admin', authAdmin, adminRoutes);

// --- MAPEAMENTO DAS VIEWS (Dashboard EJS) ---
app.use('/', dashboardRoutes);

// --- CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS ---
const frontendPath = path.resolve(__dirname, '..', 'frontend');
app.use('/pages', express.static(path.join(frontendPath, 'pages')));
app.use('/assets', express.static(path.join(frontendPath, 'assets')));
app.use('/css', express.static(path.join(frontendPath, 'css')));
app.use('/logo', express.static(path.join(frontendPath, 'logo')));
app.use('/ScriptGlobal', express.static(path.join(frontendPath, 'ScriptGlobal')));
app.use(express.static(frontendPath));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- ROTAS DE PÁGINAS (HTML) ---

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'login.html'));
});
// Redirecionamentos de segurança para evitar o "Cannot GET"
app.get('/index.html', (req, res) => res.redirect('/'));
app.get('/login.html', (req, res) => res.redirect('/login'));

app.get('/agendamento', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'agendamento.html'));
});
app.get('/clinicas', (req, res) => {
  // Aqui você vai apontar para o arquivo HTML que criaremos para listar as clínicas
  res.sendFile(path.join(frontendPath, 'pages', 'listagem_clinicas.html'));
});

app.get('/pacientes', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'pacientes.html'));
});

app.get('/equipe', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'equipe.html'));
});

app.get('/financeiro', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'financeiro.html'));
});

// Rota para renderizar a página de configurações
app.get('/dashboard/configuracoes', authMiddleware, (req, res) => {
  res.render('configuracoes'); // Renderiza o arquivo views/configuracoes.ejs
});

// --- ROTA DO PAINEL ADMIN (MASTER) ---
// Protegida: Só entra se for o admin@medlm.com
app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'admin.html'));
});

module.exports = app;