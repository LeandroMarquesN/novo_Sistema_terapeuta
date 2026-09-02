const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const portalPacienteController = require('../controllers/portalPacienteController');
const verificarAcessoPortal = require('../middleware/portalPacienteMiddleware');

// Configuração do Multer (memória → buffer pro R2)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

router.get('/login', portalPacienteController.validarAcessoPortal);
router.get('/api/dados', verificarAcessoPortal, portalPacienteController.getDadosPortal);

// Nova rota de upload
router.post(
    '/api/upload-documento',
    verificarAcessoPortal,
    upload.single('arquivo'),
    portalPacienteController.uploadDocumentoPortal
);

// Dashboard
router.get('/dashboard', verificarAcessoPortal, (req, res) => {
    const filePath = path.join(frontendPath, 'pages', 'portalPacientesdash.html');
    res.sendFile(filePath);
});

module.exports = router;