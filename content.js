/* ── DOM → Markdown walker ───────────────────────────────── */
const SKIP_TAGS = new Set(['script','style','noscript','nav','footer','header','aside','button','form','select','iframe','svg']);
const BLOCK_TAGS = new Set(['p','div','section','article','main','blockquote','figure','figcaption','details','summary','li','dt','dd']);

function nodeToMd(node, ctx = { listDepth: 0 }) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent.replace(/\n/g, ' ');
    return ctx.pre ? node.textContent : t;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return '';

  const kids = (c = ctx) => Array.from(node.childNodes).map(n => nodeToMd(n, c)).join('');

  // Headings
  if (/^h[1-6]$/.test(tag)) {
    const lvl = tag[1];
    const text = node.innerText.trim();
    return `\n${'#'.repeat(lvl)} ${text}\n`;
  }

  // Code blocks
  if (tag === 'pre') {
    const code = node.querySelector('code');
    const lang = (code?.className || '').match(/language-(\w+)/)?.[1] || '';
    const text = (code || node).innerText;
    return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
  }
  if (tag === 'code') {
    if (node.closest('pre')) return node.textContent;
    return `\`${node.innerText.replace(/`/g, "'")}\``;
  }

  // Inline formatting
  if (tag === 'strong' || tag === 'b') return `**${kids()}**`;
  if (tag === 'em'     || tag === 'i') return `*${kids()}*`;
  if (tag === 's'      || tag === 'del') return `~~${kids()}~~`;
  if (tag === 'mark')  return `==${kids()}==`;
  if (tag === 'br')    return '  \n';
  if (tag === 'hr')    return '\n---\n';

  // Links
  if (tag === 'a') {
    const href = node.href;
    const text = kids().trim();
    if (!text) return '';
    if (!href || href.startsWith('javascript:') || href === window.location.href + '#') return text;
    return `[${text}](${href})`;
  }

  // Images
  if (tag === 'img') {
    const src = node.src;
    if (!src || src.startsWith('data:')) return '';
    return `![${node.alt || ''}](${src})`;
  }

  // Blockquote
  if (tag === 'blockquote') {
    const inner = kids().trim().split('\n').map(l => `> ${l}`).join('\n');
    return `\n${inner}\n`;
  }

  // Lists
  if (tag === 'ul' || tag === 'ol') {
    const depth = ctx.listDepth;
    const indent = '  '.repeat(depth);
    let i = 0;
    const items = Array.from(node.childNodes)
      .filter(n => n.nodeName.toLowerCase() === 'li')
      .map(li => {
        const bullet = tag === 'ol' ? `${++i}.` : '-';
        const content = nodeToMd(li, { ...ctx, listDepth: depth + 1 }).trim().replace(/\n/g, `\n${indent}  `);
        return `${indent}${bullet} ${content}`;
      });
    return `\n${items.join('\n')}\n`;
  }
  if (tag === 'li') return kids(ctx);

  // Tables
  if (tag === 'table') {
    const rows = Array.from(node.querySelectorAll('tr'));
    if (!rows.length) return '';
    const mdRows = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th,td'));
      return '| ' + cells.map(c => c.innerText.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |';
    });
    if (node.querySelector('th')) {
      const cols = rows[0].querySelectorAll('th,td').length;
      mdRows.splice(1, 0, '| ' + Array(cols).fill('---').join(' | ') + ' |');
    }
    return `\n${mdRows.join('\n')}\n`;
  }
  if (tag === 'tr' || tag === 'th' || tag === 'td' || tag === 'thead' || tag === 'tbody') return kids();

  // Block containers — just recurse, add spacing
  if (BLOCK_TAGS.has(tag)) return `\n${kids()}\n`;

  return kids();
}

function domToMarkdown(root) {
  return nodeToMd(root)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── Extraction ──────────────────────────────────────────── */
function extractAndBuildMarkdown() {
  const title = document.title || '';
  const url = window.location.href;
  const description =
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content || '';
  const author =
    document.querySelector('meta[name="author"]')?.content ||
    document.querySelector('meta[property="article:author"]')?.content || '';
  const published =
    document.querySelector('meta[property="article:published_time"]')?.content ||
    document.querySelector('time[datetime]')?.getAttribute('datetime') || '';

  const root = document.querySelector('article,main,[role="main"]') || document.body;
  const body = domToMarkdown(root);

  const L = [];
  L.push(`# ${title}`, '');
  L.push(`**URL:** ${url}`);
  if (description) L.push(`**Description:** ${description}`);
  if (author)      L.push(`**Author:** ${author}`);
  if (published)   L.push(`**Published:** ${published}`);
  L.push('', body);

  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ── Toast UI (Shadow DOM) ───────────────────────────────── */
let toastHost = null;
let toastTimer = null;

function ensureToastHost() {
  if (toastHost) return toastHost.shadowRoot;
  toastHost = document.createElement('div');
  toastHost.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;';
  const shadow = toastHost.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      .wrap {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      }
      .toast {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 16px;
        background: #1a1a30;
        border: 1px solid rgba(124,106,247,0.25);
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
        color: #e2e2f0;
        font-size: 13px;
        font-weight: 500;
        animation: in 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards;
        min-width: 220px;
        max-width: 340px;
        backdrop-filter: blur(12px);
      }
      .toast.out { animation: out 0.18s ease forwards; }
      .icon { font-size: 15px; flex-shrink: 0; }
      .msg { flex: 1; line-height: 1.4; }
      .save-btn {
        padding: 4px 10px;
        background: rgba(124,106,247,0.18);
        color: #a78bfa;
        border: 1px solid rgba(124,106,247,0.3);
        border-radius: 6px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.12s;
        font-family: inherit;
      }
      .save-btn:hover { background: rgba(124,106,247,0.3); }
      @keyframes in  { from { opacity:0; transform:translateY(12px) scale(0.95); } to { opacity:1; transform:none; } }
      @keyframes out { from { opacity:1; transform:none; }  to { opacity:0; transform:translateY(8px) scale(0.97); } }
    </style>
    <div class="wrap"></div>`;
  document.documentElement.appendChild(toastHost);
  return shadow;
}

function showToast({ type = 'success', text, markdown, filename }) {
  const shadow = ensureToastHost();
  const wrap = shadow.querySelector('.wrap');

  const el = document.createElement('div');
  el.className = 'toast';
  const icon = type === 'success' ? '✦' : '✕';
  el.innerHTML = `<span class="icon">${icon}</span><span class="msg">${text}</span>`;

  if (markdown) {
    const btn = document.createElement('button');
    btn.className = 'save-btn';
    btn.textContent = 'Save .md';
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'saveFile', markdown, filename });
      btn.textContent = 'Saving…';
      btn.disabled = true;
    });
    el.appendChild(btn);
  }

  wrap.appendChild(el);

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 4000);
}

/* ── Message handler ─────────────────────────────────────── */
if (!window.__p2mdListening) {
  window.__p2mdListening = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'extractAndCopy') {
      try {
        const markdown = extractAndBuildMarkdown();
        const filename = (document.title || 'page')
          .replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'page';

        try {
          const ta = document.createElement('textarea');
          ta.value = markdown;
          ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast({ type: 'success', text: 'Copied as Markdown', markdown, filename: `${filename}.md` });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ error: e.message });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
      return true;
    }

    if (msg.action === 'showToast') {
      showToast({ type: msg.type, text: msg.text });
      sendResponse({ ok: true });
    }
    return true;
  });
}
