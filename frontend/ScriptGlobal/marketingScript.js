
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                space: ['Space Grotesk', 'sans-serif']
            }
        }
    }
}

const token = localStorage.getItem('token');
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

// ─── LÓGICA DO PAINEL DE CRÉDITOS DE WHATSAPP ───
async function carregarDadosCreditosWhatsApp() {
    try {
        const res = await fetch('/api/marketing/creditos-whatsapp', { headers });
        if (!res.ok) return;
        const data = await res.json();

        const saldo = data.whatsapp_creditos || 0;
        const totalComprado = data.total_comprado_mes || 0;

        document.getElementById('saldoCreditosDisplay').textContent = saldo;
        document.getElementById('totalCompradoDisplay').textContent = `${totalComprado} créditos`;
        document.getElementById('mensagensGarantidasDisplay').textContent = `${saldo} disparos`;

        const banner = document.getElementById('bannerAlertaCreditos');
        const textoAlerta = document.getElementById('textoAlertaCreditos');

        if (saldo === 0) {
            banner.classList.remove('hidden');
            banner.className = "mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between gap-3";
            textoAlerta.innerHTML = `<i class="fas fa-ban text-red-400 text-base"></i> Seus créditos de WhatsApp esgotaram! Faça uma recarga para continuar disparando campanhas.`;
        } else if (saldo < 50) {
            banner.classList.remove('hidden');
            banner.className = "mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between gap-3";
            textoAlerta.innerHTML = `<i class="fas fa-triangle-exclamation text-amber-400 text-base"></i> Atenção: restam apenas <strong>${saldo} créditos</strong> de WhatsApp em sua conta.`;
        } else {
            banner.classList.add('hidden');
        }
    } catch (err) {
        console.error('Erro ao carregar créditos de WhatsApp:', err);
    }
}

async function comprarCreditosWhatsApp(pacote) {
    if (!confirm(`Deseja prosseguir para a compra do pacote de ${pacote} disparos de WhatsApp?`)) return;

    try {
        const res = await fetch('/api/pagamentos/criar-preferencia', {
            method: 'POST',
            headers,
            body: JSON.stringify({ pacote })
        });
        const data = await res.json();

        if (data.init_point) {
            window.location.href = data.init_point;
        } else {
            alert(data.erro || 'Erro ao gerar link de pagamento.');
        }
    } catch (err) {
        console.error('Erro na requisição de pagamento:', err);
        alert('Falha ao conectar com o gateway de pagamento.');
    }
}
async function atualizarContadorPublico() {
    const el = document.getElementById('contadorPublico');
    if (!el) return;
    el.innerHTML = '<i class="fas fa-spinner fa-spin mr-1 text-cyan-400"></i> Calculando público-alvo...';
    try {
        const res = await fetch('/api/marketing/publico-alvo?tipoPublico=todos', { headers });
        const data = await res.json();
        el.innerHTML = `<i class="fas fa-users mr-1 text-cyan-400"></i> Enviando para <strong class="text-emerald-400">${data.total || 0}</strong> paciente(s)`;
    } catch (err) {
        if (el) el.textContent = 'Não foi possível calcular o público-alvo.';
    }
}

// ─── Histórico e Listagem de Campanhas ───
let paginaAtual = 1;
let debounceTimer = null;

function debounceFiltro() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => carregarCampanhas(1), 400);
}

function mudarPagina(delta) {
    carregarCampanhas(paginaAtual + delta);
}

async function carregarCampanhas(pagina = 1) {
    const el = document.getElementById('listaCampanhas');
    if (!el) return;

    const params = new URLSearchParams({ pagina, porPagina: 10 });

    try {
        const res = await fetch(`/api/marketing/campanhas?${params}`, { headers });
        const data = await res.json();
        paginaAtual = data.pagina || 1;

        if (!data.campanhas || !data.campanhas.length) {
            el.innerHTML = '<tr><td colspan="5" class="py-6 px-6 text-center text-slate-500">Nenhuma campanha encontrada.</td></tr>';
            return;
        }

        el.innerHTML = data.campanhas.map((c) => {
            const pct = c.total_destinatarios ? Math.round((c.total_enviados / c.total_destinatarios) * 100) : 0;
            return `
    <tr>
        <td class="py-3.5 px-4 sm:px-6">
            <span class="block text-slate-200 font-bold">${c.titulo}</span>
            <span class="text-[10px] text-slate-500">${c.assunto}</span>
        </td>
        <td class="py-3.5 px-4 sm:px-6 text-slate-400">${c.tipo_publico}</td>
        <td class="py-3.5 px-4 sm:px-6"><span class="badge-status badge-${c.status}">${c.status.replace(/_/g, ' ')}</span></td>
        <td class="py-3.5 px-4 sm:px-6">
            <div class="flex items-center gap-2">
                <div class="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-400" style="width:${pct}%"></div>
                </div>
                <span class="text-[10px] text-slate-500">${c.total_enviados}/${c.total_destinatarios}</span>
            </div>
        </td>
        <td class="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">${new Date(c.criado_em).toLocaleString('pt-BR')}</td>
    </tr>`;
        }).join('');
    } catch (err) {
        el.innerHTML = '<tr><td colspan="5" class="py-6 px-6 text-center text-red-400">Erro ao carregar campanhas.</td></tr>';
    }
}
// ─── Atualiza o mockup de visualização do email ───
function atualizarPreview() {
    const corpoEl = document.getElementById('campoCorpo');
    const assuntoEl = document.getElementById('campoAssunto');
    const previewCorpoEl = document.getElementById('previewCorpo');
    const previewAssuntoEl = document.getElementById('previewAssunto');

    if (!corpoEl || !previewCorpoEl) return;

    const corpo = corpoEl.innerHTML.trim() || '<span style="color:#94a3b8">Comece a escrever sua mensagem...</span>';
    const assunto = assuntoEl ? (assuntoEl.value.trim() || '(sem assunto)') : '(sem assunto)';

    previewCorpoEl.innerHTML = corpo.replace(/{{\s*nome_paciente\s*}}/g, '<strong>Maria</strong>');
    if (previewAssuntoEl) {
        previewAssuntoEl.textContent = assunto;
    }
}

// Vincula o evento de input no campo de assunto se ele existir
document.addEventListener('DOMContentLoaded', () => {
    const campoAssunto = document.getElementById('campoAssunto');
    if (campoAssunto) {
        campoAssunto.addEventListener('input', atualizarPreview);
    }
    atualizarPreview();
});

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosCreditosWhatsApp();
    atualizarContadorPublico?.();
    carregarCampanhas?.();
    atualizarPreview?.();
});