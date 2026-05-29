// middleware/authAtendimento.js
module.exports = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }

  const { cargo } = req.usuario;

  // ⛔ LISTA EXPANDIDA: Quem tem permissão para operar o módulo de atendimento e prontuários
  const cargosPermitidos = [
    'dono',
    'admin',
    'terapeuta',
    'medico',
    'psicologo',
    'fisioterapeuta',
    'nutricionista',
    'fonoaudiologo',
    'profissional da saude'
  ];

  if (!cargosPermitidos.includes(cargo)) {
    // 🌐 Requisições de API (Fetch/Axios)
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(403).json({ error: 'Acesso negado. Este módulo é exclusivo para profissionais de saúde autorizados.' });
    } else {

      // 💎 Tela de Bloqueio Premium em Glassmorphism
      return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>Acesso Restrito | MedLM</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
          <style>
            body {
              font-family: 'Poppins', sans-serif;
              background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              overflow: hidden;
            }
            .glass-modal {
              background: rgba(255, 255, 255, 0.35);
              backdrop-filter: blur(25px);
              -webkit-backdrop-filter: blur(25px);
              border: 1px solid rgba(255, 255, 255, 0.3);
              border-radius: 30px;
              padding: 3rem;
              max-width: 500px;
              width: 100%;
              text-align: center;
              box-shadow: 0 24px 50px rgba(0, 0, 0, 0.1);
              transform: scale(0.95);
              animation: modalSurgir 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            @keyframes modalSurgir {
              to { transform: scale(1); opacity: 1; }
            }
            .icon-shield {
              width: 80px;
              height: 80px;
              background: rgba(239, 68, 68, 0.15);
              border: 2px solid rgba(239, 68, 68, 0.3);
              color: #ef4444;
              border-radius: 50px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2.2rem;
              margin: 0 auto 1.5rem auto;
              animation: pulse 2s infinite;
            }
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
              70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
              100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            .btn-return {
              background: white;
              color: #1e293b;
              font-weight: 600;
              border-radius: 16px;
              padding: 0.75rem 2rem;
              border: none;
              transition: all 0.3s ease;
              box-shadow: 0 8px 16px rgba(0,0,0,0.05);
            }
            .btn-return:hover {
              background: #1e293b;
              color: white;
              transform: translateY(-2px);
              box-shadow: 0 12px 20px rgba(0,0,0,0.12);
            }
          </style>
        </head>
        <body>

          <div class="glass-modal">
            <div class="icon-shield">
              <i class="fas fa-shield-alt"></i>
            </div>
            <h3 class="fw-bold text-white mb-2">Acesso Restrito</h3>
            <p class="text-white text-opacity-90 mb-4">
              Este módulo é exclusivo para profissionais de saúde e atendimento. Seu cargo atual de <strong>${cargo || 'Não Identificado'}</strong> não possui permissão de entrada.
            </p>

            <div class="alert alert-light bg-white bg-opacity-20 border-0 text-white rounded-3 small mb-4 py-2">
              <i class="fas fa-spinner fa-spin me-2"></i> Redirecionando para a Dashboard em <span id="countdown">5</span>s...
            </div>

            <button class="btn-return w-100" onclick="window.location.href='/dashboard'">
              <i class="fas fa-arrow-left me-2"></i> Voltar Agora
            </button>
          </div>

          <script>
            let tempo = 5;
            const link = document.getElementById('countdown');
            const intervalo = setInterval(() => {
              tempo--;
              link.innerText = tempo;
              if(tempo <= 0) {
                clearInterval(intervalo);
                window.location.href = '/dashboard';
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
    }
  }

  next(); // Passou com sucesso!
};