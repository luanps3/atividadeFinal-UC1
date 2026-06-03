/* ════════════════════════════════════════════════════════════════════════
   app.js — Lógica Principal da Aplicação
   Responsável por: navegação entre painéis, validação, contadores,
   geração de PDF e inicialização geral.
   Depende de: ui.js (showToast, updateProgressPct) e jsPDF (CDN).
   ════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────
let currentPanel = 'ho';
const panelDone  = { ho: false, es: false, gm: false };

// ── SWITCH PANEL ──────────────────────────────────────────────────────────
/**
 * Ativa o painel selecionado, atualiza abas, tabs-bar e pills.
 * Também dispara o salvamento automático via storage.js.
 * @param {'ho'|'es'|'gm'} id - Identificador do painel
 */
function switchPanel(id) {
  currentPanel = id;

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

  const panel = document.getElementById('panel-' + id);
  const tab   = document.getElementById('tab-' + id);
  if (panel) panel.classList.add('active');
  if (tab)   tab.classList.add('active');

  const tabsBar = document.getElementById('tabs-bar');
  if (tabsBar) tabsBar.className = 'tabs-bar ctx-' + id;

  // Atualiza pills de progresso
  ['ho', 'es', 'gm'].forEach(p => {
    const pill = document.getElementById('pill-' + p);
    if (!pill) return;
    pill.classList.remove('active-ho', 'active-es', 'active-gm', 'done');
    if (panelDone[p] && p !== id) pill.classList.add('done');
    else if (p === id)            pill.classList.add('active-' + id);
  });

  // Aciona o salvamento após mudança de painel (storage.js define scheduleSave)
  if (typeof scheduleSave === 'function') scheduleSave();
}

// ── VALIDATE PANEL ────────────────────────────────────────────────────────
/**
 * Verifica se todos os campos obrigatórios do painel estão preenchidos.
 * @param {'ho'|'es'|'gm'} id
 * @returns {boolean}
 */
function validatePanel(id) {
  const panel = document.getElementById('panel-' + id);
  if (!panel) return false;

  const inputs = panel.querySelectorAll('input[required], textarea[required]');
  let allFilled = true;
  inputs.forEach(el => { if (!el.value.trim()) allFilled = false; });
  return allFilled;
}

// ── CHECK ALL ─────────────────────────────────────────────────────────────
/**
 * Valida todos os três painéis e atualiza dots, pills e texto de status.
 */
function checkAll() {
  let doneCount = 0;

  ['ho', 'es', 'gm'].forEach(id => {
    const ok = validatePanel(id);
    panelDone[id] = ok;

    const dot = document.getElementById('dot-' + id);
    if (dot) dot.classList.toggle('done', ok);

    const chk = document.getElementById('chk-' + id);
    if (chk) chk.textContent = ok ? '✓' : '';

    const pill = document.getElementById('pill-' + id);
    if (pill) {
      pill.classList.remove('done', 'active-ho', 'active-es', 'active-gm');
      if (id === currentPanel) pill.classList.add('active-' + id);
      else if (ok)             pill.classList.add('done');
    }

    if (ok) doneCount++;
  });

  const txt = document.getElementById('status-text');
  if (txt) {
    if (doneCount === 3) {
      txt.innerHTML = 'Todos os perfis preenchidos — pronto para entregar!';
    } else {
      const left = 3 - doneCount;
      txt.innerHTML = `Faltam <strong>${left} perfil${left > 1 ? 'is' : ''}</strong> para concluir tudo`;
    }
  }
}

// ── UPDATE COUNT ──────────────────────────────────────────────────────────
/**
 * Atualiza o contador de caracteres de uma textarea de conclusão.
 * Chamado inline via oninput no HTML.
 * @param {HTMLTextAreaElement} el      - A textarea
 * @param {string}              countId - ID do span contador
 */
function updateCount(el, countId) {
  const n    = el.value.length;
  const span = document.getElementById(countId);
  if (!span) return;
  span.textContent = n + ' caracteres';
  span.className   = 'char-count' + (n >= 600 ? ' ok' : n >= 300 ? ' warn' : '');
}

// ── CLEAR CURRENT TAB ─────────────────────────────────────────────────────
/**
 * Limpa apenas os campos da aba atualmente ativa.
 */
function clearCurrent() {
  const panel = document.getElementById('panel-' + currentPanel);
  if (!panel) return;

  panel.querySelectorAll('input, textarea').forEach(el => el.value = '');

  const counter = document.getElementById(currentPanel + '-count');
  if (counter) {
    counter.textContent = '0 caracteres';
    counter.className   = 'char-count';
  }

  checkAll();
  if (typeof updateProgressPct === 'function') updateProgressPct();
  if (typeof scheduleSave      === 'function') scheduleSave();
  if (typeof showToast         === 'function') showToast('Campos da aba atual foram limpos.', 'info');
}

// ── TRY SUBMIT (TODOS OS PAINÉIS) ────────────────────────────────────────
/**
 * Verifica preenchimento e gera PDF completo com todos os painéis.
 */
function trySubmit() {
  checkAll();
  const hasIncomplete = !panelDone.ho || !panelDone.es || !panelDone.gm;
  if (hasIncomplete) {
    alert("Atenção: Algumas informações não foram preenchidas no formulário. Elas aparecerão como 'NÃO FOI PREENCHIDO' em vermelho no PDF.");
  }
  generatePDF('all');
}

// ── TRY SUBMIT CURRENT ────────────────────────────────────────────────────
/**
 * Verifica preenchimento e gera PDF apenas do painel atual.
 */
function trySubmitCurrent() {
  checkAll();
  if (!panelDone[currentPanel]) {
    const nameMap = { ho: 'Designer Gráfico', es: 'Escritório', gm: 'PC Gamer' };
    alert("Atenção: Algumas informações da aba " + nameMap[currentPanel] + " não foram preenchidas. Elas aparecerão como 'NÃO FOI PREENCHIDO' em vermelho no PDF.");
  }
  generatePDF(currentPanel);
}

// ── GET VALUE HELPER ──────────────────────────────────────────────────────
/**
 * Retorna o valor (trimmed) de um campo pelo ID.
 * @param {string} id
 * @returns {string}
 */
function v(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// ── GENERATE PDF ──────────────────────────────────────────────────────────
/**
 * Gera o PDF da atividade usando jsPDF.
 * @param {'ho'|'es'|'gm'|'all'} targetTab
 */
async function generatePDF(targetTab = 'all') {
  document.getElementById('overlay').classList.add('show');
  await new Promise(r => setTimeout(r, 80));

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, PAD = 14;
    const CW = W - PAD * 2;
    let y = 0;

    function formatUrlLabel(url, maxWidth) {
      if (!url) return '';
      if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
      if (doc.getTextWidth(url) <= maxWidth) return url;
      let suffix = '...', truncated = url;
      while (truncated.length > 0 && doc.getTextWidth(truncated + suffix) > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      return truncated + suffix;
    }

    const COLORS = {
      ho: [37, 99, 235],   es: [5, 150, 105],  gm: [220, 38, 38],
      ink: [26, 26, 30],   muted: [114, 114, 126], line: [228, 228, 234],
      pale_ho: [239, 246, 255], pale_es: [236, 253, 245], pale_gm: [254, 242, 242],
    };

    function newPage() { doc.addPage(); y = PAD; }
    function checkY(needed = 10) { if (y + needed > 285) newPage(); }

    function hline(color = COLORS.line) {
      doc.setDrawColor(...color); doc.setLineWidth(0.3);
      doc.line(PAD, y, W - PAD, y); y += 4;
    }

    function sectionHead(num, label, accentColor) {
      checkY(14);
      doc.setFillColor(...accentColor);
      doc.roundedRect(PAD, y, 14, 5.5, 1, 1, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(255,255,255);
      doc.text(num, PAD + 2, y + 3.8);
      doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.setTextColor(...COLORS.ink);
      doc.text(label, PAD + 18, y + 4);
      y += 9;
      doc.setDrawColor(...COLORS.line); doc.setLineWidth(0.3);
      doc.line(PAD, y, W - PAD, y); y += 4;
    }

    function row(label, val, indent = 0) {
      checkY(7);
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...COLORS.muted);
      doc.text(label.toUpperCase(), PAD + indent, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      let drawVal = val;
      let isUrl = drawVal && (drawVal.startsWith('http://') || drawVal.startsWith('https://'));
      let displayVal = isUrl ? formatUrlLabel(drawVal, CW - indent - 36) : drawVal;
      if (!displayVal || displayVal.trim() === '') {
        doc.setTextColor(220, 38, 38); displayVal = 'NÃO FOI PREENCHIDO';
      } else if (isUrl) { doc.setTextColor(37, 99, 235); }
      else { doc.setTextColor(...COLORS.ink); }
      const lines = doc.splitTextToSize(displayVal, CW - indent - 36);
      if (isUrl) doc.textWithLink(lines.join('\n'), PAD + indent + 36, y, { url: drawVal });
      else doc.text(lines, PAD + indent + 36, y);
      y += Math.max(5, lines.length * 4.2);
    }

    function twoRow(l1, v1, l2, v2) {
      checkY(7);
      const half = CW / 2 - 4;
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.muted);
      doc.text(l1.toUpperCase(), PAD, y);
      doc.text(l2.toUpperCase(), PAD + CW/2 + 2, y);
      y += 3.5;
      doc.setFont('helvetica','normal'); doc.setFontSize(9);

      function drawVal(val, x) {
        let drawV = val;
        let isUrl = drawV && (drawV.startsWith('http://') || drawV.startsWith('https://'));
        let displayV = isUrl ? formatUrlLabel(drawV, half) : drawV;
        if (!displayV || displayV.trim() === '') {
          doc.setTextColor(220, 38, 38); displayV = 'NÃO FOI PREENCHIDO';
        } else if (isUrl) { doc.setTextColor(37, 99, 235); }
        else { doc.setTextColor(...COLORS.ink); }
        const lines = doc.splitTextToSize(displayV, half);
        if (isUrl) doc.textWithLink(lines.join('\n'), x, y, { url: drawV });
        else doc.text(lines, x, y);
        return lines.length;
      }

      const n1 = drawVal(v1, PAD);
      const n2 = drawVal(v2, PAD + CW/2 + 2);
      y += Math.max(5, Math.max(n1, n2) * 4.2);
    }

    function cardHeader(label, accentColor) {
      checkY(8);
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...accentColor);
      doc.text('- ' + label, PAD, y); y += 5;
    }

    function cmpTable(headers, rows, accentColor) {
      checkY(30);
      const cols = [42, 48, 48, 48];
      const xs   = [PAD, PAD+42, PAD+90, PAD+138];
      doc.setFillColor(...accentColor);
      doc.rect(PAD, y, CW, 7, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(255,255,255);
      headers.forEach((h,i) => doc.text(h, xs[i] + 2, y + 4.8));
      y += 7;
      rows.forEach((r, ri) => {
        const rowH = 7; checkY(rowH);
        if (ri % 2 === 0) { doc.setFillColor(248,248,250); doc.rect(PAD, y, CW, rowH, 'F'); }
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.muted);
        doc.text(r[0], xs[0] + 2, y + 4.8);
        r.slice(1).forEach((val, i) => {
          let drawVal = val;
          if (!drawVal || drawVal.trim() === '') { doc.setTextColor(220, 38, 38); drawVal = 'NÃO FOI PREENCHIDO'; }
          else { doc.setTextColor(...COLORS.ink); }
          doc.setFont('helvetica', (!val || val.trim() === '') ? 'bold' : 'normal');
          const lines = doc.splitTextToSize(drawVal, cols[i+1] - 4);
          doc.text(lines[0], xs[i+1] + 2, y + 4.8);
        });
        y += rowH;
      });
      doc.setDrawColor(...COLORS.line); doc.setLineWidth(0.3);
      doc.rect(PAD, y - rows.length * 7 - 7, CW, rows.length * 7 + 7, 'S');
      y += 4;
    }

    function conclusao(text) {
      checkY(10);
      doc.setFont('helvetica','italic'); doc.setFontSize(9);
      let drawText = text;
      if (!drawText || drawText.trim() === '') {
        doc.setTextColor(220, 38, 38); doc.setFont('helvetica','bold');
        drawText = 'NÃO FOI PREENCHIDO';
      } else { doc.setTextColor(...COLORS.ink); }
      const lines = doc.splitTextToSize(drawText, CW);
      lines.forEach(line => { checkY(5); doc.text(line, PAD, y); y += 5; });
      y += 2;
    }

    function pageTitle(title, subtitle, accentColor, paleColor) {
      y = PAD;
      doc.setFillColor(...accentColor); doc.rect(0, 0, 5, 297, 'F');
      doc.setFillColor(...paleColor);   doc.rect(5, 0, 205, 36, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(...accentColor);
      doc.text('Estudo de Caso', PAD + 2, 14);
      doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(...COLORS.ink);
      doc.text(title, PAD + 2, 22);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.muted);
      doc.text(subtitle, PAD + 2, 29);
      y = 42;
    }

    function compBlock(title, items, accentColor) {
      checkY(8); cardHeader(title, accentColor);
      items.forEach(([l, v1, v2, v3]) => {
        checkY(6);
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.muted);
        doc.text(l.toUpperCase(), PAD + 4, y);
        let startX = PAD + 40;
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
        let hasLink = v3 && (v3.startsWith('http://') || v3.startsWith('https://'));
        if (!v1 || v1.trim() === '') {
          doc.setTextColor(220, 38, 38); doc.setFont('helvetica','bold');
          doc.text('NÃO FOI PREENCHIDO', startX, y);
          startX += doc.getTextWidth('NÃO FOI PREENCHIDO ');
        } else {
          if (hasLink) { doc.setTextColor(37, 99, 235); doc.textWithLink(v1, startX, y, { url: v3 }); }
          else { doc.setTextColor(...COLORS.ink); doc.text(v1, startX, y); }
          startX += doc.getTextWidth(v1 + ' ');
        }
        doc.setTextColor(...COLORS.muted); doc.setFont('helvetica','bold');
        doc.text(' · ', startX, y); startX += doc.getTextWidth(' · ');
        if (!v2 || v2.trim() === '') {
          doc.setTextColor(220, 38, 38); doc.text('NÃO FOI PREENCHIDO', startX, y);
        } else {
          doc.setTextColor(...COLORS.ink); doc.setFont('helvetica','normal');
          doc.text('R$ ' + v2, startX, y);
        }
        y += 5;
      });
      y += 2;
    }

    // ── PANEL DESIGNER GRÁFICO ──
    if (targetTab === 'ho' || targetTab === 'all') {
      pageTitle('Designer Gráfico — Criação de Conteúdo',
        'Softwares: Adobe Photoshop · Illustrator · Dreamweaver · Premiere Pro · After Effects',
        COLORS.ho, COLORS.pale_ho);

      twoRow('Aluno(s)', v('ho-nome'), 'Turma', v('ho-turma'));
      row('Data', v('ho-data')); y += 3; hline();

      sectionHead('01','Pesquisa de Notebooks', COLORS.ho);
      cardHeader('Notebook Intel', COLORS.ho);
      row('Marca e Modelo', v('ho-nb-i-modelo'), 4);
      twoRow('Processador', v('ho-nb-i-cpu'), 'GPU', v('ho-nb-i-gpu'));
      twoRow('RAM', v('ho-nb-i-ram'), 'Armazenamento', v('ho-nb-i-hd'));
      twoRow('Preço', 'R$ ' + v('ho-nb-i-preco'), 'Fonte', v('ho-nb-i-link'));
      y += 2;
      cardHeader('Notebook AMD', COLORS.ho);
      row('Marca e Modelo', v('ho-nb-a-modelo'), 4);
      twoRow('Processador', v('ho-nb-a-cpu'), 'GPU', v('ho-nb-a-gpu'));
      twoRow('RAM', v('ho-nb-a-ram'), 'Armazenamento', v('ho-nb-a-hd'));
      twoRow('Preço', 'R$ ' + v('ho-nb-a-preco'), 'Fonte', v('ho-nb-a-link'));
      y += 2; hline();

      sectionHead('02','Desktop Pronto', COLORS.ho);
      cardHeader('Desktop Intel', COLORS.ho);
      row('Marca e Modelo', v('ho-dt-i-modelo'), 4);
      twoRow('Processador', v('ho-dt-i-cpu'), 'GPU', v('ho-dt-i-gpu'));
      twoRow('RAM', v('ho-dt-i-ram'), 'Armazenamento', v('ho-dt-i-hd'));
      twoRow('Preço', 'R$ ' + v('ho-dt-i-preco'), 'Fonte', v('ho-dt-i-link'));
      y += 2;
      cardHeader('Desktop AMD', COLORS.ho);
      row('Marca e Modelo', v('ho-dt-a-modelo'), 4);
      twoRow('Processador', v('ho-dt-a-cpu'), 'GPU', v('ho-dt-a-gpu'));
      twoRow('RAM', v('ho-dt-a-ram'), 'Armazenamento', v('ho-dt-a-hd'));
      twoRow('Preço', 'R$ ' + v('ho-dt-a-preco'), 'Fonte', v('ho-dt-a-link'));
      y += 2; hline();

      sectionHead('03','Montagem Personalizada', COLORS.ho);
      compBlock('Configuração Intel', [
        ['CPU',              v('ho-mt-i-cpu'),  v('ho-mt-i-cpu-p'),  v('ho-mt-i-cpu-link')],
        ['Placa-mãe',        v('ho-mt-i-mb'),   v('ho-mt-i-mb-p'),   v('ho-mt-i-mb-link')],
        ['RAM',              v('ho-mt-i-ram'),  v('ho-mt-i-ram-p'),  v('ho-mt-i-ram-link')],
        ['Armazenamento',    v('ho-mt-i-hd'),   v('ho-mt-i-hd-p'),   v('ho-mt-i-hd-link')],
        ['GPU',              v('ho-mt-i-gpu'),  v('ho-mt-i-gpu-p'),  v('ho-mt-i-gpu-link')],
        ['Fonte',            v('ho-mt-i-psu'),  v('ho-mt-i-psu-p'),  v('ho-mt-i-psu-link')],
        ['Monitor',          v('ho-mt-i-mon'),  v('ho-mt-i-mon-p'),  v('ho-mt-i-mon-link')],
        ['Gabinete + Cooler',v('ho-mt-i-gab'),  v('ho-mt-i-gab-p'),  v('ho-mt-i-gab-link')],
      ], COLORS.ho);
      row('Total Intel (R$)', v('ho-mt-i-total'), 4); y += 3;

      compBlock('Configuração AMD', [
        ['CPU',              v('ho-mt-a-cpu'),  v('ho-mt-a-cpu-p'),  v('ho-mt-a-cpu-link')],
        ['Placa-mãe',        v('ho-mt-a-mb'),   v('ho-mt-a-mb-p'),   v('ho-mt-a-mb-link')],
        ['RAM',              v('ho-mt-a-ram'),  v('ho-mt-a-ram-p'),  v('ho-mt-a-ram-link')],
        ['Armazenamento',    v('ho-mt-a-hd'),   v('ho-mt-a-hd-p'),   v('ho-mt-a-hd-link')],
        ['GPU',              v('ho-mt-a-gpu'),  v('ho-mt-a-gpu-p'),  v('ho-mt-a-gpu-link')],
        ['Fonte',            v('ho-mt-a-psu'),  v('ho-mt-a-psu-p'),  v('ho-mt-a-psu-link')],
        ['Monitor',          v('ho-mt-a-mon'),  v('ho-mt-a-mon-p'),  v('ho-mt-a-mon-link')],
        ['Gabinete + Cooler',v('ho-mt-a-gab'),  v('ho-mt-a-gab-p'),  v('ho-mt-a-gab-link')],
      ], COLORS.ho);
      row('Total AMD (R$)', v('ho-mt-a-total'), 4); y += 2; hline();

      sectionHead('04','Tabela Comparativa', COLORS.ho);
      cmpTable(
        ['Critério','Notebook','Desktop Pronto','Montado'],
        [
          ['Processador',   v('ho-cmp-cpu-nb'),   v('ho-cmp-cpu-dt'),   v('ho-cmp-cpu-mt')],
          ['RAM',           v('ho-cmp-ram-nb'),   v('ho-cmp-ram-dt'),   v('ho-cmp-ram-mt')],
          ['Armazenamento', v('ho-cmp-hd-nb'),    v('ho-cmp-hd-dt'),    v('ho-cmp-hd-mt')],
          ['Placa de Vídeo',v('ho-cmp-gpu-nb'),   v('ho-cmp-gpu-dt'),   v('ho-cmp-gpu-mt')],
          ['Preço (R$)',    v('ho-cmp-preco-nb'), v('ho-cmp-preco-dt'), v('ho-cmp-preco-mt')],
          ['Vantagens',     v('ho-cmp-van-nb'),   v('ho-cmp-van-dt'),   v('ho-cmp-van-mt')],
          ['Desvantagens',  v('ho-cmp-des-nb'),   v('ho-cmp-des-dt'),   v('ho-cmp-des-mt')],
        ], COLORS.ho);

      sectionHead('05','Conclusão', COLORS.ho);
      conclusao(v('ho-conclusao'));
    }

    // ── PANEL ESCRITÓRIO ──
    if (targetTab === 'es' || targetTab === 'all') {
      if (targetTab === 'all') newPage();
      pageTitle('Escritório — Produtividade Corporativa',
        'Softwares: Office 365 · Google Workspace · Teams/Zoom · ERPs · Navegador',
        COLORS.es, COLORS.pale_es);

      twoRow('Aluno(s)', v('es-nome'), 'Turma', v('es-turma'));
      row('Data', v('es-data')); y += 3; hline();

      sectionHead('01','Notebooks Corporativos', COLORS.es);
      cardHeader('Notebook Intel', COLORS.es);
      row('Marca e Modelo', v('es-nb-i-modelo'), 4);
      twoRow('Processador', v('es-nb-i-cpu'), 'Bateria', v('es-nb-i-bat'));
      twoRow('RAM', v('es-nb-i-ram'), 'Armazenamento', v('es-nb-i-hd'));
      twoRow('Preço', 'R$ ' + v('es-nb-i-preco'), 'Fonte', v('es-nb-i-link'));
      y += 2;
      cardHeader('Notebook AMD', COLORS.es);
      row('Marca e Modelo', v('es-nb-a-modelo'), 4);
      twoRow('Processador', v('es-nb-a-cpu'), 'Bateria', v('es-nb-a-bat'));
      twoRow('RAM', v('es-nb-a-ram'), 'Armazenamento', v('es-nb-a-hd'));
      twoRow('Preço', 'R$ ' + v('es-nb-a-preco'), 'Fonte', v('es-nb-a-link'));
      y += 2; hline();

      sectionHead('02','Desktops Corporativos Prontos', COLORS.es);
      cardHeader('Desktop Intel', COLORS.es);
      row('Marca e Modelo', v('es-dt-i-modelo'), 4);
      twoRow('Processador', v('es-dt-i-cpu'), 'Conectividade', v('es-dt-i-net'));
      twoRow('RAM', v('es-dt-i-ram'), 'Armazenamento', v('es-dt-i-hd'));
      twoRow('Preço', 'R$ ' + v('es-dt-i-preco'), 'Fonte', v('es-dt-i-link'));
      y += 2;
      cardHeader('Desktop AMD', COLORS.es);
      row('Marca e Modelo', v('es-dt-a-modelo'), 4);
      twoRow('Processador', v('es-dt-a-cpu'), 'Conectividade', v('es-dt-a-net'));
      twoRow('RAM', v('es-dt-a-ram'), 'Armazenamento', v('es-dt-a-hd'));
      twoRow('Preço', 'R$ ' + v('es-dt-a-preco'), 'Fonte', v('es-dt-a-link'));
      y += 2; hline();

      sectionHead('03','Estação de Trabalho Personalizada', COLORS.es);
      compBlock('Configuração Intel', [
        ['CPU',           v('es-mt-i-cpu'),  v('es-mt-i-cpu-p'),  v('es-mt-i-cpu-link')],
        ['Placa-mãe',     v('es-mt-i-mb'),   v('es-mt-i-mb-p'),   v('es-mt-i-mb-link')],
        ['RAM',           v('es-mt-i-ram'),  v('es-mt-i-ram-p'),  v('es-mt-i-ram-link')],
        ['Armazenamento', v('es-mt-i-hd'),   v('es-mt-i-hd-p'),   v('es-mt-i-hd-link')],
        ['Monitor',       v('es-mt-i-mon'),  v('es-mt-i-mon-p'),  v('es-mt-i-mon-link')],
        ['Fonte',         v('es-mt-i-psu'),  v('es-mt-i-psu-p'),  v('es-mt-i-psu-link')],
        ['Gabinete',      v('es-mt-i-gab'),  v('es-mt-i-gab-p'),  v('es-mt-i-gab-link')],
        ['Periféricos',   v('es-mt-i-per'),  v('es-mt-i-per-p'),  v('es-mt-i-per-link')],
      ], COLORS.es);
      row('Total Intel (R$)', v('es-mt-i-total'), 4); y += 3;

      compBlock('Configuração AMD', [
        ['CPU',           v('es-mt-a-cpu'),  v('es-mt-a-cpu-p'),  v('es-mt-a-cpu-link')],
        ['Placa-mãe',     v('es-mt-a-mb'),   v('es-mt-a-mb-p'),   v('es-mt-a-mb-link')],
        ['RAM',           v('es-mt-a-ram'),  v('es-mt-a-ram-p'),  v('es-mt-a-ram-link')],
        ['Armazenamento', v('es-mt-a-hd'),   v('es-mt-a-hd-p'),   v('es-mt-a-hd-link')],
        ['Monitor',       v('es-mt-a-mon'),  v('es-mt-a-mon-p'),  v('es-mt-a-mon-link')],
        ['Fonte',         v('es-mt-a-psu'),  v('es-mt-a-psu-p'),  v('es-mt-a-psu-link')],
        ['Gabinete',      v('es-mt-a-gab'),  v('es-mt-a-gab-p'),  v('es-mt-a-gab-link')],
        ['Periféricos',   v('es-mt-a-per'),  v('es-mt-a-per-p'),  v('es-mt-a-per-link')],
      ], COLORS.es);
      row('Total AMD (R$)', v('es-mt-a-total'), 4); y += 2; hline();

      sectionHead('04','Tabela Comparativa', COLORS.es);
      cmpTable(
        ['Critério','Notebook','Desktop Pronto','Montado'],
        [
          ['Processador',         v('es-cmp-cpu-nb'),   v('es-cmp-cpu-dt'),   v('es-cmp-cpu-mt')],
          ['RAM',                 v('es-cmp-ram-nb'),   v('es-cmp-ram-dt'),   v('es-cmp-ram-mt')],
          ['Armazenamento',       v('es-cmp-hd-nb'),    v('es-cmp-hd-dt'),    v('es-cmp-hd-mt')],
          ['Custo/unidade',       v('es-cmp-preco-nb'), v('es-cmp-preco-dt'), v('es-cmp-preco-mt')],
          ['Manutenção',          v('es-cmp-man-nb'),   v('es-cmp-man-dt'),   v('es-cmp-man-mt')],
          ['Vantagens',           v('es-cmp-van-nb'),   v('es-cmp-van-dt'),   v('es-cmp-van-mt')],
          ['Desvantagens',        v('es-cmp-des-nb'),   v('es-cmp-des-dt'),   v('es-cmp-des-mt')],
        ], COLORS.es);

      sectionHead('05','Conclusão', COLORS.es);
      conclusao(v('es-conclusao'));
    }

    // ── PANEL GAMER ──
    if (targetTab === 'gm' || targetTab === 'all') {
      if (targetTab === 'all') newPage();
      pageTitle('PC Gamer — Alto Desempenho',
        'Games AAA (1080p/1440p/4K) · OBS Studio · Discord · Steam / Epic Games',
        COLORS.gm, COLORS.pale_gm);

      twoRow('Aluno(s)', v('gm-nome'), 'Turma', v('gm-turma'));
      row('Data', v('gm-data')); y += 3; hline();

      sectionHead('01','Notebooks Gamer', COLORS.gm);
      cardHeader('Notebook Intel', COLORS.gm);
      row('Marca e Modelo', v('gm-nb-i-modelo'), 4);
      twoRow('Processador', v('gm-nb-i-cpu'), 'GPU + VRAM', v('gm-nb-i-gpu'));
      twoRow('RAM', v('gm-nb-i-ram'), 'Armazenamento', v('gm-nb-i-hd'));
      twoRow('Display', v('gm-nb-i-tela'), 'Preço', 'R$ ' + v('gm-nb-i-preco'));
      row('Fonte', v('gm-nb-i-link'), 4); y += 2;
      cardHeader('Notebook AMD', COLORS.gm);
      row('Marca e Modelo', v('gm-nb-a-modelo'), 4);
      twoRow('Processador', v('gm-nb-a-cpu'), 'GPU + VRAM', v('gm-nb-a-gpu'));
      twoRow('RAM', v('gm-nb-a-ram'), 'Armazenamento', v('gm-nb-a-hd'));
      twoRow('Display', v('gm-nb-a-tela'), 'Preço', 'R$ ' + v('gm-nb-a-preco'));
      row('Fonte', v('gm-nb-a-link'), 4); y += 2; hline();

      sectionHead('02','Desktop Gamer Pronto', COLORS.gm);
      cardHeader('Desktop Intel', COLORS.gm);
      row('Marca e Modelo', v('gm-dt-i-modelo'), 4);
      twoRow('Processador', v('gm-dt-i-cpu'), 'GPU + VRAM', v('gm-dt-i-gpu'));
      twoRow('RAM', v('gm-dt-i-ram'), 'Armazenamento', v('gm-dt-i-hd'));
      twoRow('Preço', 'R$ ' + v('gm-dt-i-preco'), 'Fonte', v('gm-dt-i-link'));
      y += 2;
      cardHeader('Desktop AMD', COLORS.gm);
      row('Marca e Modelo', v('gm-dt-a-modelo'), 4);
      twoRow('Processador', v('gm-dt-a-cpu'), 'GPU + VRAM', v('gm-dt-a-gpu'));
      twoRow('RAM', v('gm-dt-a-ram'), 'Armazenamento', v('gm-dt-a-hd'));
      twoRow('Preço', 'R$ ' + v('gm-dt-a-preco'), 'Fonte', v('gm-dt-a-link'));
      y += 2; hline();

      sectionHead('03','PC Gamer Personalizado', COLORS.gm);
      compBlock('Configuração Intel', [
        ['CPU',              v('gm-mt-i-cpu'),  v('gm-mt-i-cpu-p'),  v('gm-mt-i-cpu-link')],
        ['Placa-mãe',        v('gm-mt-i-mb'),   v('gm-mt-i-mb-p'),   v('gm-mt-i-mb-link')],
        ['RAM',              v('gm-mt-i-ram'),  v('gm-mt-i-ram-p'),  v('gm-mt-i-ram-link')],
        ['Armazenamento',    v('gm-mt-i-hd'),   v('gm-mt-i-hd-p'),   v('gm-mt-i-hd-link')],
        ['GPU',              v('gm-mt-i-gpu'),  v('gm-mt-i-gpu-p'),  v('gm-mt-i-gpu-link')],
        ['Fonte',            v('gm-mt-i-psu'),  v('gm-mt-i-psu-p'),  v('gm-mt-i-psu-link')],
        ['Monitor Gamer',    v('gm-mt-i-mon'),  v('gm-mt-i-mon-p'),  v('gm-mt-i-mon-link')],
        ['Gabinete + Cooler',v('gm-mt-i-gab'),  v('gm-mt-i-gab-p'),  v('gm-mt-i-gab-link')],
      ], COLORS.gm);
      row('Total Intel (R$)', v('gm-mt-i-total'), 4); y += 3;

      compBlock('Configuração AMD', [
        ['CPU',              v('gm-mt-a-cpu'),  v('gm-mt-a-cpu-p'),  v('gm-mt-a-cpu-link')],
        ['Placa-mãe',        v('gm-mt-a-mb'),   v('gm-mt-a-mb-p'),   v('gm-mt-a-mb-link')],
        ['RAM',              v('gm-mt-a-ram'),  v('gm-mt-a-ram-p'),  v('gm-mt-a-ram-link')],
        ['Armazenamento',    v('gm-mt-a-hd'),   v('gm-mt-a-hd-p'),   v('gm-mt-a-hd-link')],
        ['GPU',              v('gm-mt-a-gpu'),  v('gm-mt-a-gpu-p'),  v('gm-mt-a-gpu-link')],
        ['Fonte',            v('gm-mt-a-psu'),  v('gm-mt-a-psu-p'),  v('gm-mt-a-psu-link')],
        ['Monitor Gamer',    v('gm-mt-a-mon'),  v('gm-mt-a-mon-p'),  v('gm-mt-a-mon-link')],
        ['Gabinete + Cooler',v('gm-mt-a-gab'),  v('gm-mt-a-gab-p'),  v('gm-mt-a-gab-link')],
      ], COLORS.gm);
      row('Total AMD (R$)', v('gm-mt-a-total'), 4); y += 2; hline();

      sectionHead('04','Tabela Comparativa', COLORS.gm);
      cmpTable(
        ['Critério','Notebook','Desktop Pronto','PC Montado'],
        [
          ['Processador',   v('gm-cmp-cpu-nb'),   v('gm-cmp-cpu-dt'),   v('gm-cmp-cpu-mt')],
          ['GPU + VRAM',    v('gm-cmp-gpu-nb'),   v('gm-cmp-gpu-dt'),   v('gm-cmp-gpu-mt')],
          ['RAM',           v('gm-cmp-ram-nb'),   v('gm-cmp-ram-dt'),   v('gm-cmp-ram-mt')],
          ['Taxa Refresh',  v('gm-cmp-hz-nb'),    v('gm-cmp-hz-dt'),    v('gm-cmp-hz-mt')],
          ['Preço (R$)',    v('gm-cmp-preco-nb'), v('gm-cmp-preco-dt'), v('gm-cmp-preco-mt')],
          ['Vantagens',     v('gm-cmp-van-nb'),   v('gm-cmp-van-dt'),   v('gm-cmp-van-mt')],
          ['Desvantagens',  v('gm-cmp-des-nb'),   v('gm-cmp-des-dt'),   v('gm-cmp-des-mt')],
        ], COLORS.gm);

      sectionHead('05','Conclusão', COLORS.gm);
      conclusao(v('gm-conclusao'));
    }

    // Salva o arquivo
    const nomeAluno = (targetTab === 'all'
      ? (v('ho-nome') || v('es-nome') || v('gm-nome'))
      : v(targetTab + '-nome')) || 'atividade';
    const tabName = targetTab === 'all' ? 'completo'
      : (targetTab === 'ho' ? 'designer-grafico'
      : targetTab === 'es' ? 'escritorio' : 'pc-gamer');
    const filename = 'estudo-de-caso-' + tabName + '-' +
      nomeAluno.split(/[\s\/]/)[0].toLowerCase() + '.pdf';
    doc.save(filename);

  } catch (e) {
    console.error(e);
    if (typeof showToast === 'function')
      showToast('Erro ao gerar PDF. Tente novamente.', 'error');
  }

  document.getElementById('overlay').classList.remove('show');
}

// ── EVENT LISTENERS GLOBAIS ───────────────────────────────────────────────
// Validação e progresso em tempo real (event delegation)
document.addEventListener('input',  () => { checkAll(); updateProgressPct(); });
document.addEventListener('change', () => { checkAll(); updateProgressPct(); });

// ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────
(function init() {
  // Inicializa modal de confirmação (ui.js)
  if (typeof initConfirmModal === 'function') initConfirmModal();

  // Estado inicial dos indicadores
  checkAll();
  updateProgressPct();

  // Inicializa persistência após toda a lógica estar definida (storage.js)
  if (typeof initPersistence === 'function') initPersistence();
})();
