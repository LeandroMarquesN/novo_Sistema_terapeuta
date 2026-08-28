const express = require('express');
const router = express.Router();
const multer = require('multer');

const pacientesController = require('../controllers/pacientesController');
const auth = require('../middleware/authMiddleware');

// Upload só em memória → buffer vai para o Cloudinary no controller
const uploadFoto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Apenas imagens são permitidas.'));
        }
        cb(null, true);
    },
});

// ── Lista ativos ──────────────────────────────────────────────
router.get('/', auth, pacientesController.listarPacientes);

// ── Arquivados (ANTES de rotas com :id) ───────────────────────
router.get('/arquivados', auth, pacientesController.listarArquivados);

// ── Ficha / prontuário ────────────────────────────────────────
router.get('/ficha-express/:id', auth, pacientesController.obterFichaExpressa);
router.get('/:id/prontuario', auth, pacientesController.verProntuario);

// ── Foto (Cloudinary) ─────────────────────────────────────────
router.patch(
    '/:id/foto',
    auth,
    uploadFoto.single('foto'),
    pacientesController.atualizarFoto
);

// ── Arquivar / Restaurar ──────────────────────────────────────
router.patch('/:id/arquivar', auth, pacientesController.arquivarPaciente);
router.patch('/:id/restaurar', auth, pacientesController.restaurarPaciente);

module.exports = router;