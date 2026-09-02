const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });
const patientDocumentsController = require('../controllers/PatientDocumentsController');

// Upload de exame/documento — agora exige autenticação
router.post(
    '/documentos/upload',
    auth,
    upload.single('documento'),
    (req, res) => patientDocumentsController.uploadDocumento(req, res)
);

// Listar documentos de um paciente (com URLs assinadas)
router.get(
    '/documentos/paciente/:pacienteId',
    auth,
    (req, res) => patientDocumentsController.listarDocumentos(req, res)
);

module.exports = router;