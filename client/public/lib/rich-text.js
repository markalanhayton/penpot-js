/**
 * @module rich-text
 * @description Rich text editing with contentEditable — full font selection,
 * multi-line editing, inline formatting (bold/italic/underline/strikethrough),
 * text alignment, font family/size selection, color, line height, letter spacing,
 * and bullet/numbered lists. Uses document.execCommand with modern fallbacks.
 */

let activeEditor = null;
let activeToolbar = null;

const SYSTEM_FONTS = [
  { family: 'sans-serif', label: 'Sans Serif' },
  { family: 'serif', label: 'Serif' },
  { family: 'monospace', label: 'Monospace' },
  { family: 'Inter', label: 'Inter' },
  { family: 'Roboto', label: 'Roboto' },
  { family: 'Open Sans', label: 'Open Sans' },
  { family: 'Lato', label: 'Lato' },
  { family: 'Montserrat', label: 'Montserrat' },
  { family: 'Source Code Pro', label: 'Source Code Pro' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

export function createRichTextEditor(container, shape, onCommit) {
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', shape.name || 'Text editor');
  editor.setAttribute('aria-multiline', 'true');
  editor.id = 'rich-text-editor';
  editor.style.cssText = `
    position: absolute;
    left: ${shape.x || 0}px;
    top: ${shape.y || 0}px;
    min-width: 40px;
    min-height: 20px;
    outline: none;
    word-wrap: break-word;
    white-space: pre-wrap;
    line-height: ${shape.lineHeight || 1.4};
    letter-spacing: ${shape.letterSpacing || 0}px;
    padding: 2px 4px;
    color: ${getTextColor(shape)};
    font-size: ${shape.fontSize || 14}px;
    font-family: ${shape.fontFamily || 'sans-serif'};
    font-weight: ${shape.fontWeight || 400};
    font-style: ${shape.fontStyle === 'italic' ? 'italic' : 'normal'};
    text-decoration: ${getTextDecoration(shape)};
    text-align: ${shape.textAlign || 'left'};
    background: transparent;
    border: 2px solid var(--penpot-primary, #31efb8);
    z-index: 100;
    overflow-wrap: break-word;
  `;

  if (shape.html && shape.html !== shape.content) {
    editor.innerHTML = shape.html;
  } else {
    editor.textContent = shape.content || shape.text || '';
  }

  container.appendChild(editor);
  activeEditor = editor;

  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  let committed = false;

  const commit = () => {
    if (committed) return;
    committed = true;
    const content = editor.innerHTML;
    const plainText = editor.textContent;
    if (onCommit) {
      onCommit({
        content: plainText,
        html: content,
        fontFamily: editor.style.fontFamily,
        fontSize: parseFloat(editor.style.fontSize),
        fontWeight: parseInt(editor.style.fontWeight),
        fontStyle: editor.style.fontStyle === 'italic' ? 'italic' : 'normal',
        textDecoration: editor.style.textDecoration,
        textAlign: editor.style.textAlign,
        color: editor.style.color,
        lineHeight: parseFloat(editor.style.lineHeight),
        letterSpacing: parseFloat(editor.style.letterSpacing) || 0,
      });
    }
    if (editor.parentNode) editor.parentNode.removeChild(editor);
    if (activeEditor === editor) activeEditor = null;
    if (activeToolbar) {
      if (activeToolbar.parentNode) activeToolbar.parentNode.removeChild(activeToolbar);
      activeToolbar = null;
    }
  };

  editor.addEventListener('blur', () => {
    setTimeout(commit, 150);
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
  });

  editor.addEventListener('input', () => {
    updateToolbarState();
  });

  editor.addEventListener('mouseup', () => {
    setTimeout(updateToolbarState, 10);
  });

  editor.addEventListener('keyup', () => {
    setTimeout(updateToolbarState, 10);
  });

  return {
    editor,
    commit,
    applyFont(family) {
      document.execCommand('fontName', false, family);
      editor.style.fontFamily = family;
    },
    applySize(size) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      sel.removeAllRanges();
      sel.addRange(editor.ownerDocument.createRange());
      document.execCommand('fontSize', false, '7');
      const fontEls = editor.querySelectorAll('font[size="7"]');
      fontEls.forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = `${size}px`;
      });
      editor.style.fontSize = `${size}px`;
    },
    applyBold() {
      document.execCommand('bold', false, null);
    },
    applyItalic() {
      document.execCommand('italic', false, null);
    },
    applyUnderline() {
      document.execCommand('underline', false, null);
    },
    applyStrikethrough() {
      document.execCommand('strikeThrough', false, null);
    },
    applyAlign(align) {
      const cmdMap = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' };
      document.execCommand(cmdMap[align] || 'justifyLeft', false, null);
    },
    applyColor(color) {
      document.execCommand('foreColor', false, color);
    },
    applyLineHeight(lh) {
      editor.style.lineHeight = String(lh);
    },
    applyLetterSpacing(ls) {
      editor.style.letterSpacing = `${ls}px`;
    },
    applySubscript() {
      document.execCommand('subscript', false, null);
    },
    applySuperscript() {
      document.execCommand('superscript', false, null);
    },
    applyBulletList() {
      document.execCommand('insertUnorderedList', false, null);
    },
    applyNumberedList() {
      document.execCommand('insertOrderedList', false, null);
    },
    applyParagraphSpacing(value) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      let node = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const block = node && node.closest ? node.closest('p,h1,h2,h3,h4,div,li') : null;
      if (block) {
        block.style.marginTop = `${value}px`;
        block.style.marginBottom = `${value}px`;
      } else if (activeEditor) {
        activeEditor.style.setProperty('--p-spacing', `${value}px`);
      }
    },
    applyTextDirection(dir) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      let node = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      const block = node && node.closest ? node.closest('p,h1,h2,h3,h4,div,li') : null;
      if (block) {
        block.dir = dir;
      } else if (activeEditor) {
        activeEditor.dir = dir;
      }
    },
    insertLink(url) {
      document.execCommand('createLink', false, url);
    },
    removeLink() {
      document.execCommand('unlink', false, null);
    },
    getStyles() {
      return {
        fontFamily: editor.style.fontFamily,
        fontSize: parseFloat(editor.style.fontSize),
        fontWeight: parseInt(editor.style.fontWeight),
        fontStyle: editor.style.fontStyle,
        textDecoration: editor.style.textDecoration,
        textAlign: editor.style.textAlign,
        color: editor.style.color,
        lineHeight: parseFloat(editor.style.lineHeight),
        letterSpacing: parseFloat(editor.style.letterSpacing) || 0,
      };
    },
  };
}

function updateToolbarState() {
  if (!activeToolbar || !activeEditor) return;

  const toolbar = activeToolbar;
  const boldBtn = toolbar.querySelector('[data-cmd="bold"]');
  const italicBtn = toolbar.querySelector('[data-cmd="italic"]');
  const underlineBtn = toolbar.querySelector('[data-cmd="underline"]');
  const strikeBtn = toolbar.querySelector('[data-cmd="strikethrough"]');

  if (boldBtn) boldBtn.classList.toggle('active', document.queryCommandState('bold'));
  if (italicBtn) italicBtn.classList.toggle('active', document.queryCommandState('italic'));
  if (underlineBtn) underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
  if (strikeBtn) strikeBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));

  const subBtn = toolbar.querySelector('[data-cmd="subscript"]');
  const supBtn = toolbar.querySelector('[data-cmd="superscript"]');
  if (subBtn) subBtn.classList.toggle('active', document.queryCommandState('subscript'));
  if (supBtn) supBtn.classList.toggle('active', document.queryCommandState('superscript'));

  const alignLeft = toolbar.querySelector('[data-cmd="justifyLeft"]');
  const alignCenter = toolbar.querySelector('[data-cmd="justifyCenter"]');
  const alignRight = toolbar.querySelector('[data-cmd="justifyRight"]');
  if (alignLeft) alignLeft.classList.toggle('active', document.queryCommandState('justifyLeft'));
  if (alignCenter) alignCenter.classList.toggle('active', document.queryCommandState('justifyCenter'));
  if (alignRight) alignRight.classList.toggle('active', document.queryCommandState('justifyRight'));

  const fontSelect = toolbar.querySelector('.rt-font-select');
  if (fontSelect) {
    const currentFont = document.queryCommandValue('fontName')?.replace(/['"]/g, '') || activeEditor.style.fontFamily;
    fontSelect.value = currentFont;
  }

  const sizeSelect = toolbar.querySelector('.rt-size-select');
  if (sizeSelect) {
    sizeSelect.value = String(parseFloat(activeEditor.style.fontSize) || 14);
  }
}

export function createFloatingToolbar(container, editorInstance, position) {
  if (activeToolbar) {
    if (activeToolbar.parentNode) activeToolbar.parentNode.removeChild(activeToolbar);
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'rt-floating-toolbar';
  toolbar.style.cssText = `
    position: fixed;
    left: ${position.x}px;
    top: ${position.y}px;
    background: var(--penpot-surface, #2a2a2a);
    border: 1px solid var(--penpot-border, #444);
    border-radius: 6px;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    gap: 2px;
    z-index: 110;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    user-select: none;
  `;

  const fontSelect = document.createElement('select');
  fontSelect.className = 'rt-font-select';
  fontSelect.style.cssText = 'background:var(--penpot-surface-high,#333);border:1px solid var(--penpot-border,#444);color:var(--penpot-text,#e6e6e6);border-radius:3px;padding:2px 4px;font-size:11px;outline:none;max-width:110px;';
  SYSTEM_FONTS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.family;
    opt.textContent = f.label;
    opt.style.fontFamily = f.family;
    fontSelect.appendChild(opt);
  });
  fontSelect.value = 'sans-serif';
  fontSelect.addEventListener('change', () => editorInstance.applyFont(fontSelect.value));
  fontSelect.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.appendChild(fontSelect);

  const sizeSelect = document.createElement('select');
  sizeSelect.className = 'rt-size-select';
  sizeSelect.style.cssText = 'background:var(--penpot-surface-high,#333);border:1px solid var(--penpot-border,#444);color:var(--penpot-text,#e6e6e6);border-radius:3px;padding:2px 4px;font-size:11px;outline:none;width:52px;';
  FONT_SIZES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = String(s);
    opt.textContent = String(s);
    sizeSelect.appendChild(opt);
  });
  sizeSelect.value = '14';
  sizeSelect.addEventListener('change', () => editorInstance.applySize(parseInt(sizeSelect.value, 10)));
  sizeSelect.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.appendChild(sizeSelect);

  const headingSelect = document.createElement('select');
  headingSelect.className = 'rt-heading-select';
  headingSelect.style.cssText = 'background:var(--penpot-surface-high,#333);border:1px solid var(--penpot-border,#444);color:var(--penpot-text,#e6e6e6);border-radius:3px;padding:2px 4px;font-size:11px;outline:none;max-width:72px;';
  const headingOpts = [
    { value: 'p', label: 'Normal' },
    { value: 'h1', label: 'H1' },
    { value: 'h2', label: 'H2' },
    { value: 'h3', label: 'H3' },
    { value: 'h4', label: 'H4' },
  ];
  headingOpts.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.value;
    opt.textContent = h.label;
    headingSelect.appendChild(opt);
  });
  headingSelect.value = 'p';
  headingSelect.addEventListener('change', () => {
    const val = headingSelect.value;
    if (val === 'p') {
      document.execCommand('formatBlock', false, 'p');
    } else {
      document.execCommand('formatBlock', false, val);
    }
  });
  headingSelect.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.appendChild(headingSelect);

  const lineHSelect = document.createElement('select');
  lineHSelect.className = 'rt-lineh-select';
  lineHSelect.style.cssText = 'background:var(--penpot-surface-high,#333);border:1px solid var(--penpot-border,#444);color:var(--penpot-text,#e6e6e6);border-radius:3px;padding:2px 4px;font-size:11px;outline:none;width:52px;margin-left:2px;';
  [{ value: '1', label: '1.0' }, { value: '1.2', label: '1.2' }, { value: '1.4', label: '1.4' }, { value: '1.6', label: '1.6' }, { value: '1.8', label: '1.8' }, { value: '2', label: '2.0' }].forEach(lh => {
    const opt = document.createElement('option');
    opt.value = lh.value;
    opt.textContent = lh.label;
    lineHSelect.appendChild(opt);
  });
  lineHSelect.value = '1.4';
  lineHSelect.addEventListener('change', () => {
    editorInstance.applyLineHeight(parseFloat(lineHSelect.value));
  });
  lineHSelect.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.appendChild(lineHSelect);

  toolbar.appendChild(makeSep());

  const formatBtns = [
    { cmd: 'bold', label: 'B', style: 'font-weight:700;' },
    { cmd: 'italic', label: 'I', style: 'font-style:italic;' },
    { cmd: 'underline', label: 'U', style: 'text-decoration:underline;' },
    { cmd: 'strikethrough', label: 'S', style: 'text-decoration:line-through;' },
  ];
  for (const b of formatBtns) {
    const btn = makeToolbarBtn(b.label, b.cmd, b.style);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      editorInstance[b.cmd === 'bold' ? 'applyBold' : b.cmd === 'italic' ? 'applyItalic' : b.cmd === 'underline' ? 'applyUnderline' : 'applyStrikethrough']();
      updateToolbarState();
    });
    toolbar.appendChild(btn);
  }

  toolbar.appendChild(makeSep());

  const alignBtns = [
    { cmd: 'justifyLeft', label: '\u2261' },
    { cmd: 'justifyCenter', label: '\u2261' },
    { cmd: 'justifyRight', label: '\u2261' },
  ];
  const alignLabels = ['\u2630', '\u2630\u00B7', '\u00B7\u2630'];
  alignBtns.forEach((b, i) => {
    const btn = makeToolbarBtn(alignLabels[i], b.cmd, 'font-size:12px;');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const alignMap = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right' };
      editorInstance.applyAlign(alignMap[b.cmd]);
      updateToolbarState();
    });
    toolbar.appendChild(btn);
  });

  toolbar.appendChild(makeSep());

  const listBtns = [
    { cmd: 'bullet', label: '\u2022' },
    { cmd: 'number', label: '1.' },
  ];
  for (const b of listBtns) {
    const btn = makeToolbarBtn(b.label, b.cmd, 'font-size:13px;');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (b.cmd === 'bullet') editorInstance.applyBulletList();
      else editorInstance.applyNumberedList();
    });
    toolbar.appendChild(btn);
  }

  toolbar.appendChild(makeSep());

  const subBtn = makeToolbarBtn('X\u2082', 'subscript', 'font-size:10px;');
  subBtn.addEventListener('click', (e) => { e.preventDefault(); editorInstance.applySubscript(); updateToolbarState(); });
  toolbar.appendChild(subBtn);
  const supBtn = makeToolbarBtn('X\u00B2', 'superscript', 'font-size:10px;');
  supBtn.addEventListener('click', (e) => { e.preventDefault(); editorInstance.applySuperscript(); updateToolbarState(); });
  toolbar.appendChild(supBtn);

  toolbar.appendChild(makeSep());

  const paraSpacingSelect = document.createElement('select');
  paraSpacingSelect.className = 'rt-para-spacing-select';
  paraSpacingSelect.style.cssText = 'background:var(--penpot-surface-high,#333);border:1px solid var(--penpot-border,#444);color:var(--penpot-text,#e6e6e6);border-radius:3px;padding:2px 4px;font-size:10px;outline:none;width:42px;margin-left:2px;';
  paraSpacingSelect.title = 'Paragraph spacing';
  [{ value: '0', label: '0' }, { value: '4', label: '4' }, { value: '8', label: '8' }, { value: '12', label: '12' }, { value: '16', label: '16' }, { value: '24', label: '24' }].forEach(ps => {
    const opt = document.createElement('option');
    opt.value = ps.value;
    opt.textContent = ps.label;
    paraSpacingSelect.appendChild(opt);
  });
  paraSpacingSelect.value = '0';
  paraSpacingSelect.addEventListener('change', () => {
    editorInstance.applyParagraphSpacing(parseInt(paraSpacingSelect.value, 10));
  });
  paraSpacingSelect.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.appendChild(paraSpacingSelect);

  const dirBtn = makeToolbarBtn('\u2194', 'textdirection', 'font-size:12px;');
  dirBtn.title = 'Toggle text direction (LTR/RTL)';
  let currentDir = 'ltr';
  dirBtn.addEventListener('click', (e) => {
    e.preventDefault();
    currentDir = currentDir === 'ltr' ? 'rtl' : 'ltr';
    editorInstance.applyTextDirection(currentDir);
    dirBtn.textContent = currentDir === 'rtl' ? '\u2190' : '\u2194';
  });
  toolbar.appendChild(dirBtn);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = '#e6e6e6';
  colorInput.style.cssText = 'width:22px;height:22px;border:1px solid var(--penpot-border,#444);border-radius:3px;padding:0;cursor:pointer;background:none;margin-left:4px;';
  colorInput.addEventListener('input', () => editorInstance.applyColor(colorInput.value));
  colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.appendChild(colorInput);

  container.appendChild(toolbar);
  activeToolbar = toolbar;

  updateToolbarState();

  return toolbar;
}

function makeToolbarBtn(label, cmd, extraStyle = '') {
  const btn = document.createElement('button');
  btn.dataset.cmd = cmd;
  btn.textContent = label;
  btn.style.cssText = `background:none;border:1px solid transparent;color:var(--penpot-text,#e6e6e6);border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;${extraStyle}`;
  btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--penpot-surface-high,#333)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
  return btn;
}

function makeSep() {
  const sep = document.createElement('div');
  sep.style.cssText = 'width:1px;height:18px;background:var(--penpot-border,#444);margin:0 2px;';
  return sep;
}

function getTextColor(shape) {
  if (shape.fills && shape.fills.length > 0) {
    const fill = shape.fills[0];
    if (fill.color) {
      const r = Math.round(fill.color.r * 255);
      const g = Math.round(fill.color.g * 255);
      const b = Math.round(fill.color.b * 255);
      return `rgb(${r},${g},${b})`;
    }
  }
  return '#e6e6e6';
}

function getTextDecoration(shape) {
  const parts = [];
  if (shape.textDecoration === 'underline' || shape.underline) parts.push('underline');
  if (shape.textDecoration === 'line-through' || shape.strikethrough) parts.push('line-through');
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export function getActiveEditor() {
  return activeEditor;
}

export function getActiveToolbar() {
  return activeToolbar;
}

export function destroyActiveEditor() {
  if (activeEditor && activeEditor.parentNode) {
    activeEditor.parentNode.removeChild(activeEditor);
    activeEditor = null;
  }
  if (activeToolbar && activeToolbar.parentNode) {
    activeToolbar.parentNode.removeChild(activeToolbar);
    activeToolbar = null;
  }
}

export function getSystemFonts() {
  return [...SYSTEM_FONTS];
}

export function getFontSizes() {
  return [...FONT_SIZES];
}