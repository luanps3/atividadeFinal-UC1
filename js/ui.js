/* ════════════════════════════════════════════════════════════════════════
   ui.js — Interface Utilities
   Responsável por: toasts, status de salvamento, barra de progresso,
   modal de confirmação e atualização de contadores de caracteres.
   Não depende de outros módulos locais.
   ════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── SHOW TOAST ────────────────────────────────────────────────────────────
/**
 * Exibe uma notificação toast temporária e elegante.
 * @param {string} msg  - Mensagem a exibir
 * @param {'success'|'error'|'info'|'warning'} [type='info'] - Tipo visual
 */
function showToast(msg, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'info');
  toast.innerHTML =
    '<span class="toast-icon">' + (icons[type] || 'ℹ') + '</span>' +
    '<span class="toast-msg">' + msg + '</span>';
  container.appendChild(toast);

  // Força reflow para disparar a transição CSS
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  const timer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
  }, 3500);
  toast._timer = timer;
}

// ── UPDATE SAVE STATUS ────────────────────────────────────────────────────
/**
 * Atualiza o indicador visual de salvamento no bottom-bar.
 * @param {'saving'|'saved'|'error'|'idle'} state
 * @param {string} [isoTimestamp] - ISO string do momento do salvamento
 */
function updateSaveStatus(state, isoTimestamp) {
  const dot   = document.getElementById('save-dot');
  const label = document.getElementById('save-label');
  if (!dot || !label) return;

  dot.className = 'save-dot';

  switch (state) {
    case 'saving':
      dot.classList.add('saving');
      label.textContent = 'Salvando...';
      break;

    case 'saved': {
      dot.classList.add('saved');
      const t = isoTimestamp ? new Date(isoTimestamp) : new Date();
      const hm = t.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      label.textContent = 'Salvo às ' + hm;
      break;
    }

    case 'error':
      dot.classList.add('error');
      label.textContent = 'Erro ao salvar';
      break;

    case 'idle':
    default:
      label.textContent = 'Pronto';
  }
}

// ── UPDATE PROGRESS PERCENTAGE ────────────────────────────────────────────
/**
 * Calcula o percentual de preenchimento de todos os campos obrigatórios
 * e atualiza o badge e a barra de progresso no bottom-bar.
 */
function updateProgressPct() {
  try {
    const allInputs = document.querySelectorAll('input[required], textarea[required]');
    let filled = 0;
    allInputs.forEach(el => { if (el.value && el.value.trim()) filled++; });
    const pct = allInputs.length > 0 ? Math.round((filled / allInputs.length) * 100) : 0;

    // Badge colorido
    const pctEl = document.getElementById('progress-pct');
    if (pctEl) {
      pctEl.textContent = pct + '%';
      pctEl.className = 'pct-badge' + (pct >= 80 ? '' : pct >= 30 ? ' warn' : ' empty');
    }

    // Barra de progresso
    const barFill = document.getElementById('progress-bar-fill');
    if (barFill) barFill.style.width = pct + '%';
  } catch (e) {
    // Silenciosamente ignora erros de DOM
  }
}

// ── RESTORE CHAR COUNTERS ─────────────────────────────────────────────────
/**
 * Atualiza os contadores de caracteres das textareas de conclusão
 * após restauração de dados.
 */
function restoreCharCounters() {
  ['ho', 'es', 'gm'].forEach(pfx => {
    const ta      = document.getElementById(pfx + '-conclusao');
    const counter = document.getElementById(pfx + '-count');
    if (ta && counter) {
      const n = ta.value.length;
      counter.textContent = n + ' caracteres';
      counter.className = 'char-count' +
        (n >= 600 ? ' ok' : n >= 300 ? ' warn' : '');
    }
  });
}

// ── CONFIRM MODAL ─────────────────────────────────────────────────────────
let _confirmCallback = null;

/**
 * Exibe o modal de confirmação elegante.
 * @param {string} title     - Título do modal
 * @param {string} msg       - Mensagem descritiva
 * @param {Function} onConfirm - Callback executado ao confirmar
 */
function showConfirm(title, msg, onConfirm) {
  const titleEl = document.getElementById('confirm-title');
  const msgEl   = document.getElementById('confirm-msg');
  const overlay = document.getElementById('confirm-overlay');
  if (!titleEl || !msgEl || !overlay) return;

  titleEl.textContent = title;
  msgEl.textContent   = msg;
  _confirmCallback    = onConfirm;
  overlay.classList.add('show');
}

/** Fecha o modal de confirmação sem executar a ação. */
function closeConfirm() {
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) overlay.classList.remove('show');
  _confirmCallback = null;
}

/** Inicializa os listeners do modal de confirmação. */
function initConfirmModal() {
  const okBtn  = document.getElementById('confirm-ok-btn');
  const overlay = document.getElementById('confirm-overlay');

  if (okBtn) {
    okBtn.addEventListener('click', () => {
      closeConfirm();
      if (typeof _confirmCallback === 'function') _confirmCallback();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) closeConfirm();
    });
  }
}
