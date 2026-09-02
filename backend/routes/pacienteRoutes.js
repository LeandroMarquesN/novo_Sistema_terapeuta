const express = require('express');
const router = express.Router();
const multer = require('multer');

// ⚠️ o nome do arquivo tem que bater com a pasta controllers/
const pacientesController = require('../controllers/pacientesController');
const portalPacientesDocumentosController = require('../controllers/portalPacientesDocumentosController');

const auth = require('../middleware/authMiddleware');


const uploadFoto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB (fotos de celular)
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Apenas imagens são permitidas.'));
        }
        cb(null, true);
    },
});

// Debug no boot: se algum for undefined, o log mostra qual
console.log('[pacientes routes] exports:', {
    listarPacientes: typeof pacientesController.listarPacientes,
    listarArquivados: typeof pacientesController.listarArquivados,
    obterFichaExpressa: typeof pacientesController.obterFichaExpressa,
    verProntuario: typeof pacientesController.verProntuario,
    atualizarFoto: typeof pacientesController.atualizarFoto,
    arquivarPaciente: typeof pacientesController.arquivarPaciente,
    restaurarPaciente: typeof pacientesController.restaurarPaciente,
});

// Lista ativos
router.get('/', auth, pacientesController.listarPacientes);

// Arquivados (ANTES de rotas com :id)
router.get('/arquivados', auth, pacientesController.listarArquivados);

// Ficha / prontuário
router.get('/ficha-express/:id', auth, pacientesController.obterFichaExpressa);
router.get('/:id/prontuario', auth, pacientesController.verProntuario);

// ... suas outras rotas

router.get(
    '/:pacienteId/documentos',
    authMiddleware,
    pacienteDocumentosController.listarDocumentosPaciente
);
// Foto (Cloudinary)
router.patch(
    '/:id/foto',
    auth,
    uploadFoto.single('foto'),
    pacientesController.atualizarFoto
);

// Arquivar / Restaurar
router.patch('/:id/arquivar', auth, pacientesController.arquivarPaciente);
router.patch('/:id/restaurar', auth, pacientesController.restaurarPaciente);

// Atualizar cadastro
router.patch('/:id', auth, pacientesController.atualizarPaciente);

// Enviar token de acesso ao portal
router.post('/:id/enviar-token', auth, pacientesController.enviarTokenAcesso);

module.exports = router;