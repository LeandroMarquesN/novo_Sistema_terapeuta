const express = require('express');
const app = express();
require('dotenv').config();
const pacienteRoutes = require('./routes/pacienteRoutes');

app.use(express.json());
app.use('/api/pacientes', pacienteRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
