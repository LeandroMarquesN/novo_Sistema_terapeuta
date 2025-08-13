// backend/app.js

const path = require('path');
const express = require('express');
const cors = require('cors');

const pacienteRoutes = require('./routes/pacienteRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');

const app = express();

app.use(cors());
// Remova app.use(express.json()); daqui. Ele será aplicado apenas onde necessário.
// app.use(express.json()); // REMOVA ESTA LINHA

// Rotas da API
// A rota de agendamentos é a única que precisa do Multer, então ela já terá o seu parser específico.
// Para as outras rotas, o Express.json() será usado diretamente no app.use().
app.use('/api/agendamentos', agendamentoRoutes); // agendamentoRoutes já inclui o Multer

// Para outras rotas que esperam JSON, aplique express.json() diretamente ou aqui.
// Como você tem outras rotas /api e /api/usuarios, vamos aplicar globalmente para elas.
// Mas o AGENDAMENTO já vai lidar com o body pelo Multer, então ele precisa ser o primeiro.
app.use(express.json()); // Mova para cá para que ele parseie JSON para *outras* rotas POST/PUT que não usam Multer
app.use(express.urlencoded({ extended: true })); // Adicione isso para lidar com dados de formulário simples

app.use('/api', pacienteRoutes); // Isso pode causar conflito se /api/agendamentos não for processado primeiro
app.use('/api/usuarios', usuarioRoutes);


// Servir arquivos estáticos
app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));
app.use(express.static(path.join(__dirname, 'frontend', 'pages')));
app.use('/css', express.static(path.join(__dirname, 'frontend', 'css')));

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'pages', 'index.html'));
});

module.exports = app;