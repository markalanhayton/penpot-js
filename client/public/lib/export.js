import { cmd } from './rpc.js';

export async function exportToPNG(page, options = {}) {
  const scale = options.scale || 1;
  const quality = options.quality || 0.92;
  const background = options.background || '#ffffff';

  const svgEl = renderPageToSVG(page, options);
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((options.width || img.naturalWidth || 800) * scale));
    canvas.height = Math.max(1, Math.round((options.height || img.naturalHeight || 600) * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png', quality);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportToJPEG(page, options = {}) {
  const scale = options.scale || 1;
  const quality = options.quality || 0.92;
  const background = options.background || '#ffffff';

  const svgEl = renderPageToSVG(page, options);
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((options.width || img.naturalWidth || 800) * scale));
    canvas.height = Math.max(1, Math.round((options.height || img.naturalHeight || 600) * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportToWebP(page, options = {}) {
  const scale = options.scale || 1;
  const quality = options.quality || 0.92;
  const background = options.background || '#ffffff';

  const svgEl = renderPageToSVG(page, options);
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((options.width || img.naturalWidth || 800) * scale));
    canvas.height = Math.max(1, Math.round((options.height || img.naturalHeight || 600) * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/webp', quality);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportToSVG(page, options = {}) {
  const svgEl = renderPageToSVG(page, options);
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}

export async function exportToPDF(page, options = {}) {
  const dataUrl = await exportToPNG(page, { ...options, scale: 2 });
  const { jsPDF } = await loadJsPDF();

  const img = await loadImage(dataUrl);
  const pdf = new jsPDF({
    orientation: img.width > img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width, img.height],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
  return pdf.output('bloburl');
}

export function downloadDataURL(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadBlobURL(blobUrl, filename) {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportAndDownload(page, format = 'png', options = {}) {
  const filename = options.filename || `penpot-export.${format}`;

  switch (format) {
    case 'png': {
      const dataUrl = await exportToPNG(page, options);
      downloadDataURL(dataUrl, filename);
      return dataUrl;
    }
    case 'jpeg':
    case 'jpg': {
      const dataUrl = await exportToJPEG(page, options);
      downloadDataURL(dataUrl, filename);
      return dataUrl;
    }
    case 'webp': {
      const dataUrl = await exportToWebP(page, options);
      downloadDataURL(dataUrl, filename);
      return dataUrl;
    }
    case 'svg': {
      const blobUrl = await exportToSVG(page, options);
      downloadBlobURL(blobUrl, filename);
      return blobUrl;
    }
    case 'pdf': {
      const pdfUrl = await exportToPDF(page, options);
      downloadBlobURL(pdfUrl, filename);
      return pdfUrl;
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export async function exportToServer(fileId, pageId, format = 'png', options = {}) {
  try {
    const exportType = format === 'pdf' ? 'export-frames' : 'export-shapes';
    const result = await cmd(exportType, {
      'file-id': fileId,
      'page-id': pageId,
      objects: options.objects || [{ id: 'all', name: 'export', type: format }],
      scale: options.scale || 1,
      ...(format === 'pdf' ? { type: 'pdf' } : { type: format }),
    });
    return result;
  } catch (err) {
    console.error('[export] Server export failed:', err);
    return null;
  }
}

export async function importPenpotFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const data = JSON.parse(text);

        if (data.type === 'penpot-file' || data.pages || data.objects) {
          resolve(normalizeImportedFile(data));
        } else {
          reject(new Error('Invalid Penpot file format'));
        }
      } catch (err) {
        reject(new Error(`Failed to parse file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function normalizeImportedFile(data) {
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name || 'Imported File',
    projectId: data.projectId || null,
    pages: (data.pages || []).map(page => ({
      id: page.id || crypto.randomUUID(),
      name: page.name || 'Imported Page',
      objects: page.objects || page.children || {},
    })),
    created: data.created || new Date().toISOString(),
    modified: data.modified || new Date().toISOString(),
  };
}

function renderPageToSVG(page, options = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const viewport = options.viewport || { x: 0, y: 0, width: 1200, height: 800 };

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`);
  svg.setAttribute('width', options.width || viewport.width);
  svg.setAttribute('height', options.height || viewport.height);
  svg.setAttribute('xmlns', NS);

  const objects = page.objects || page.children || {};
  const shapes = Array.isArray(objects) ? objects : Object.values(objects);

  for (const shape of shapes) {
    const el = renderShapeToSVG(shape);
    if (el) svg.appendChild(el);
  }

  return svg;
}

function renderShapeToSVG(shape) {
  if (shape.visible === false) return null;
  const NS = 'http://www.w3.org/2000/svg';

  const attrs = {
    id: `shape-${shape.id}`,
    x: shape.x || 0,
    y: shape.y || 0,
    opacity: shape.opacity ?? 1,
  };

  switch (shape.type) {
    case 'rect':
    case 'frame':
      return document.createElementNS(NS, 'rect', {
        ...attrs,
        width: shape.width || 1,
        height: shape.height || 1,
        fill: shape.fills?.[0]?.color || (shape.type === 'frame' ? '#ffffff' : '#4a90d9'),
        stroke: shape.strokes?.[0]?.color || (shape.type === 'frame' ? '#e0e0e0' : 'transparent'),
        'stroke-width': shape.strokes?.[0]?.width || 0,
        rx: shape.rx || shape.borderRadius || 0,
      });
    case 'circle':
    case 'ellipse':
      return document.createElementNS(NS, 'ellipse', {
        ...attrs,
        cx: (shape.x || 0) + (shape.width || 0) / 2,
        cy: (shape.y || 0) + (shape.height || 0) / 2,
        rx: Math.max(0.5, (shape.width || 0) / 2),
        ry: Math.max(0.5, (shape.height || 0) / 2),
        fill: shape.fills?.[0]?.color || '#4a90d9',
        stroke: shape.strokes?.[0]?.color || 'transparent',
        'stroke-width': shape.strokes?.[0]?.width || 0,
      });
    case 'text': {
      const text = document.createElementNS(NS, 'text', {
        ...attrs,
        y: (shape.y || 0) + (shape.fontSize || 14) * 0.8,
        fill: shape.fills?.[0]?.color || shape.color || '#333',
        'font-size': shape.fontSize || 14,
        'font-family': shape.fontFamily || 'sans-serif',
        'font-weight': shape.fontWeight || 'normal',
      });
      text.textContent = shape.content || shape.name || 'Text';
      return text;
    }
    case 'path':
      return document.createElementNS(NS, 'path', {
        ...attrs,
        d: shape.d || shape.pathData || '',
        fill: shape.fills?.[0]?.color || 'transparent',
        stroke: shape.strokes?.[0]?.color || '#333',
        'stroke-width': shape.strokes?.[0]?.width || 1,
      });
    case 'image': {
      const image = document.createElementNS(NS, 'image', {
        ...attrs,
        width: shape.width || 100,
        height: shape.height || 100,
        href: shape.src || shape.url || '',
        preserveAspectRatio: 'xMidYMid slice',
      });
      return image;
    }
    default:
      return document.createElementNS(NS, 'rect', {
        ...attrs,
        width: shape.width || 100,
        height: shape.height || 100,
        fill: '#ccc',
      });
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

let jsPDFPromise = null;

function loadJsPDF() {
  if (jsPDFPromise) return jsPDFPromise;

  jsPDFPromise = new Promise((resolve, reject) => {
    if (window.jspdf && window.jspdf.jsPDF) {
      resolve(window.jspdf);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf);
      } else {
        reject(new Error('jsPDF failed to load'));
      }
    };
    script.onerror = () => reject(new Error('jsPDF script failed to load'));
    document.head.appendChild(script);
  });

  return jsPDFPromise;
}