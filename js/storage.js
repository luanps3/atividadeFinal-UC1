/* ════════════════════════════════════════════════════════════════════════
   storage.js — Módulo de Persistência Local
   Responsável por: auto-save, restauração, exportação e importação JSON.
   Depende de: ui.js (showToast, updateSaveStatus, updateProgressPct,
               restoreCharCounters) e app.js (switchPanel, checkAll).
   ════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── CONSTANTES ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'atividade_estudo_de_caso_v1';

// ── ESTADO INTERNO ────────────────────────────────────────────────────────
let _debounceTimer = null;

// ── COLLECT FORM STATE ────────────────────────────────────────────────────
/**
 * Coleta o estado completo do formulário (todos os inputs, textareas,
 * selects com ID), além do painel ativo e posição de scroll.
 * @returns {{ fields: Object, meta: Object }}
 */
function collectFormState() {
  const state = { fields: {}, meta: {} };

  try {
    // Campos com ID definido
    document.querySelectorAll('input[id], textarea[id], select[id]').forEach(el => {
      if (!el.id) return;
      state.fields[el.id] = (el.type === 'checkbox' || el.type === 'radio')
        ? el.checked
        : el.value;
    });

    // Meta-informações de estado da interface
    state.meta.activePanel = typeof currentPanel !== 'undefined' ? currentPanel : 'ho';
    state.meta.scrollY     = window.scrollY;
    state.meta.timestamp   = new Date().toISOString();
  } catch (e) {
    console.warn('[storage] collectFormState error:', e);
  }

  return state;
}

// ── RESTORE FORM STATE ────────────────────────────────────────────────────
/**
 * Restaura o estado completo do formulário a partir de um objeto de estado.
 * Defensivo: ignora IDs inexistentes ou campos com erros silenciosamente.
 * @param {{ fields: Object, meta: Object }} state
 */
function restoreFormState(state) {
  if (!state || !state.fields) return;

  try {
    // Restaura valores dos campos
    Object.keys(state.fields).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return; // campo pode não existir mais — seguro ignorar
      try {
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = !!state.fields[id];
        } else {
          el.value = state.fields[id] || '';
        }
      } catch (_) { /* silenciosamente ignora campos com problemas */ }
    });

    // Restaura contadores de caracteres (textareas de conclusão)
    if (typeof restoreCharCounters === 'function') restoreCharCounters();

    // Restaura painel ativo
    if (state.meta && state.meta.activePanel) {
      if (typeof switchPanel === 'function') switchPanel(state.meta.activePanel);
    }

    // Restaura posição de scroll após o próximo frame (espera o DOM renderizar)
    if (state.meta && state.meta.scrollY) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: state.meta.scrollY, behavior: 'instant' });
      });
    }

    // Recalcula indicadores de conclusão e porcentagem
    if (typeof checkAll === 'function')         checkAll();
    if (typeof updateProgressPct === 'function') updateProgressPct();

  } catch (e) {
    console.warn('[storage] restoreFormState error:', e);
  }
}

// ── SAVE FORM DATA ────────────────────────────────────────────────────────
/**
 * Salva o estado atual no localStorage com feedback visual.
 */
function saveFormData() {
  try {
    if (typeof updateSaveStatus === 'function') updateSaveStatus('saving');

    const state = collectFormState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (typeof updateSaveStatus === 'function') updateSaveStatus('saved', state.meta.timestamp);
  } catch (e) {
    console.error('[storage] saveFormData error:', e);
    if (typeof updateSaveStatus === 'function') updateSaveStatus('error');
  }
}

// ── LOAD FORM DATA ────────────────────────────────────────────────────────
/**
 * Carrega o estado salvo do localStorage.
 * @returns {{ fields: Object, meta: Object }|null}
 */
function loadFormData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[storage] loadFormData parse error:', e);
    return null;
  }
}

// ── SCHEDULE SAVE (DEBOUNCED) ─────────────────────────────────────────────
/**
 * Agenda um salvamento com debounce de 400ms.
 * Evita gravações excessivas durante digitação rápida.
 */
function scheduleSave() {
  clearTimeout(_debounceTimer);
  if (typeof updateSaveStatus === 'function') updateSaveStatus('saving');
  _debounceTimer = setTimeout(saveFormData, 400);
}

// ── EXPORT FORM DATA ──────────────────────────────────────────────────────
/**
 * Exporta o estado atual como arquivo JSON para download,
 * permitindo continuar em outro computador.
 */
function exportFormData() {
  try {
    const state = collectFormState();
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      data: state
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'atividade-estudo-de-caso-backup.json';
    a.click();
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function')
      showToast('✓ Progresso exportado com sucesso!', 'success');
  } catch (e) {
    console.error('[storage] exportFormData error:', e);
    if (typeof showToast === 'function')
      showToast('Erro ao exportar. Tente novamente.', 'error');
  }
}

// ── IMPORT FORM DATA ──────────────────────────────────────────────────────
/**
 * Importa um arquivo JSON de backup, valida a estrutura e restaura o estado.
 * Nunca quebra a aplicação em caso de arquivo inválido.
 * @param {File} file - Objeto File selecionado pelo usuário
 */
function importFormData(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);

      // Validação de integridade
      if (!parsed || !parsed.data || !parsed.data.fields) {
        throw new Error('Estrutura JSON inválida');
      }

      // Restaura o estado
      restoreFormState(parsed.data);

      // Persiste localmente para continuidade
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));

      const ts = parsed.savedAt || new Date().toISOString();
      if (typeof updateSaveStatus === 'function') updateSaveStatus('saved', ts);

      const dateStr = parsed.savedAt
        ? new Date(parsed.savedAt).toLocaleString('pt-BR')
        : 'desconhecida';
      if (typeof showToast === 'function')
        showToast('⬆ Progresso importado! (salvo em ' + dateStr + ')', 'success');

    } catch (err) {
      console.error('[storage] importFormData error:', err);
      if (typeof showToast === 'function')
        showToast('Arquivo inválido ou corrompido. Verifique o JSON.', 'error');
    }
  };

  reader.onerror = function() {
    if (typeof showToast === 'function')
      showToast('Erro ao ler o arquivo.', 'error');
  };

  reader.readAsText(file);

  // Reseta o input para que o mesmo arquivo possa ser selecionado novamente
  const importInput = document.getElementById('import-file-input');
  if (importInput) importInput.value = '';
}

// ── CLEAR FORM DATA ───────────────────────────────────────────────────────
/**
 * Remove todos os dados salvos, limpa todos os campos e reinicia a interface.
 */
function clearFormData() {
  try {
    localStorage.removeItem(STORAGE_KEY);

    // Limpa todos os campos com ID
    document.querySelectorAll('input[id], textarea[id], select[id]').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = false;
      } else {
        el.value = '';
      }
    });

    // Reseta contadores de caracteres
    ['ho', 'es', 'gm'].forEach(pfx => {
      const counter = document.getElementById(pfx + '-count');
      if (counter) {
        counter.textContent = '0 caracteres';
        counter.className   = 'char-count';
      }
    });

    // Retorna ao primeiro painel
    if (typeof switchPanel === 'function') switchPanel('ho');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof checkAll          === 'function') checkAll();
    if (typeof updateProgressPct === 'function') updateProgressPct();
    if (typeof updateSaveStatus  === 'function') updateSaveStatus('idle');

    if (typeof showToast === 'function')
      showToast('🗑 Todos os dados foram apagados.', 'warning');

  } catch (e) {
    console.error('[storage] clearFormData error:', e);
    if (typeof showToast === 'function')
      showToast('Erro ao limpar dados.', 'error');
  }
}

// ── CONFIRM CLEAR ALL ─────────────────────────────────────────────────────
/**
 * Solicita confirmação elegante antes de limpar todos os dados.
 */
function confirmClearAll() {
  if (typeof showConfirm === 'function') {
    showConfirm(
      'Apagar todos os dados?',
      'Esta ação irá remover todo o progresso salvo localmente e limpar todos os campos. Isso não pode ser desfeito.',
      clearFormData
    );
  }
}

// ── INIT PERSISTENCE ──────────────────────────────────────────────────────
/**
 * Inicializa o sistema de persistência:
 * 1. Carrega dados salvos e restaura o estado anterior
 * 2. Configura listeners globais com event delegation (sem duplicação)
 * 3. Salva antes de fechar a aba
 * 4. Salva a posição de scroll periodicamente
 * 5. Configura o handler de importação de arquivo
 */
function initPersistence() {
  // 1. Restauração automática ao abrir
  const saved = loadFormData();
  if (saved) {
    restoreFormState(saved);
    const ts = saved.meta && saved.meta.timestamp;
    if (typeof updateSaveStatus === 'function') updateSaveStatus('saved', ts);
    if (typeof showToast        === 'function') showToast('↩ Progresso restaurado automaticamente.', 'info');
    if (typeof updateProgressPct === 'function') updateProgressPct();
  }

  // 2. Event delegation — um único listener para todos os campos do documento
  document.addEventListener('input',  scheduleSave);
  document.addEventListener('change', scheduleSave);

  // 3. Salvar antes de fechar/recarregar a aba (garante sem perda de dados)
  window.addEventListener('beforeunload', () => {
    clearTimeout(_debounceTimer);
    saveFormData();
  });

  // 4. Salvar posição de scroll (passive para não bloquear scroll)
  let _scrollTimer = null;
  window.addEventListener('scroll', () => {
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(saveFormData, 800);
  }, { passive: true });

  // 5. Handler de importação de arquivo JSON
  const importInput = document.getElementById('import-file-input');
  if (importInput) {
    importInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        importFormData(e.target.files[0]);
      }
    });
  }
}
