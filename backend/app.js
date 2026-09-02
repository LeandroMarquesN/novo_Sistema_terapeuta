require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');





// Importação das Rotas
const authRoutes = require('./routes/authRoutes');
const cadastroClinicaRoutes = require('./routes/cadastro_clinicaRoutes');
const equipeRoutes = require('./routes/equipeRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const financeiroLogger = require('./middleware/financeiroLogger');

const pacienteRoutes = require('./routes/pacienteRoutes');
const patientDocumentRoutes = require('./routes/PatienteDocumentRoutes');
const prontuarioRoutes = require('./routes/prontuarioRoutes'); // 🌟 1. Importa as rotas de prontuário
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const dashboardApiRoutes = require('./routes/dashboardapiroutes'); // NOVO

const configuracaoRoutes = require('./routes/configuracaoRoutes');
const portalRoutes = require('./routes/portal-agendamento-routes');
const portalPacientelroutes = require('./routes/portalPacienteroutes');
const openAiRoutes = require('./routes/openAiRoutes');
const adminRoutes = require('./routes/adminRoutes'); // Rotas de API do Admin
const landingPageRoutes = require('./routes/lading_pageRoutes');

const recuperarSenhaRoutes = require('./routes/recuperarSenhaRoutes')

// importação Middleware
const authAdmin = require('./middleware/authAdmin'); // Middleware de proteção
const authMiddleware = require('./middleware/authMiddleware')
const authAtendimento = require('./middleware/authAtendimento'); // 🌟 Importa a trava de atendimento
const { authorizeFeature } = require('./middleware/middlewareFeatures'); // 🌟 Importa o novo middleware

const app = express();

// --- CONFIGURAÇÃO DO EJS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));

// Middlewares padrão
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const session = require('express-session');
const { monitorEventLoopDelay } = require('perf_hooks');

// Middleware para desativar o cache (Segurança)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET, // Lê do arquivo .env
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' // Fica 'true' apenas se estiver em produção
  }
}));


// ...

// --- MAPEAMENTO DAS APIS ---
app.use('/api/auth', authRoutes);
app.use('/api/clinicas', cadastroClinicaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/pacientes', patientDocumentRoutes);

app.use('/api/prontuarios', prontuarioRoutes); // 🌟 2. Mapeia a API de prontuários

app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/equipe', equipeRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/openai', openAiRoutes);
// app.use('/api/financeiro', financeiroRoutes);
app.use('/api/financeiro', financeiroLogger, financeiroRoutes);
app.use('/api/config', configuracaoRoutes);
app.use('/api/auth', recuperarSenhaRoutes);
app.use('/agendar', portalRoutes);
app.use('/portal_paciente', portalPacientelroutes); // Aqui mapeamos o prefixo
app.use('/programa-fundadores', landingPageRoutes)
console.log("Rota /programa-fundadores montada com sucesso!");


// --- API ADMINISTRATIVA (MedLM Master) ---
// Note que usamos o authAdmin aqui para proteger os dados do financeiro master
app.use('/api/admin', authAdmin, adminRoutes);

// --- MAPEAMENTO DAS VIEWS (Dashboard EJS) ---
app.use('/', dashboardRoutes);
app.use('/api/dashboard', dashboardApiRoutes); // NOVO — agrupa com as outras rotas /api


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

app.get('/pacientes', authMiddleware, (req, res) => { // Recomendo garantir o authMiddleware aqui também!
  res.sendFile(path.join(frontendPath, 'pages', 'pacientes.html'));
});


app.get('/equipe', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'equipe.html'));
});

app.get('/financeiro', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'financeiro.html'));
});

// 🏎️ CORRIDA PURA: Rota oficial do Módulo de Atendimento Clínico
// 🏎️ ROTA PROTEGIDA DA PISTA DE ATENDIMENTO
app.get('/atendimento', authMiddleware, authAtendimento, (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'atendimento.html'));
});

// Rota para renderizar a página de configurações
app.get('/dashboard/configuracoes', authMiddleware, (req, res) => {
  res.render('configuracoes'); // Renderiza o arquivo views/configuracoes.ejs
});

// --- ROTA DO PAINEL ADMIN (MASTER) ---
// Protegida: Só entra se for o admin@medlm.com

// app.get('/admin', (req, res) => {
//   res.sendFile(path.join(frontendPath, 'pages', 'admin.html'));
// });

app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'admin.html'));
});

// Middleware de tratamento de erro genérico
app.use((err, req, res, next) => {
  console.error("Erro capturado:", err.stack);
  res.status(500).json({ error: "Algo deu errado no servidor!" });
});
module.exports = app;