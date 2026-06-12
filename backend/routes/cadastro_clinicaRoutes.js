const express = require('express');
const router = express.Router();
const controller = require('../controllers/Cadastro_Clinica'); // Importe o controller aqui


router.post('/register-clinica', controller.registerClinica);

module.exports = router;