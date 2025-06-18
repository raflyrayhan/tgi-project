const PROXY = '/api/proxy';
const RAW_ROOT_ID = '20895552-6aa5-8049-a7bc-ec16acd51067';
const ROOT_PAGE_ID = hyphenate(RAW_ROOT_ID);

// Util: ubah raw 32-char jadi 8-4-4-4-12
function hyphenate(id) {
  const s = id.replace(/-/g,'');
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}

// Fetch children blocks or page metadata
async function apiCall(body) {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API ${body.action||''} error ${res.status}`);
  return res.json();
}

// Fetch page title
async function fetchPageTitle(pageId) {
  const json = await apiCall({ action:'getPage', page_id: pageId });
  return json.properties.title.title[0]?.plain_text || 'Untitled';
}

// Fetch block children
async function fetchBlocks({ page_id=null, block_id=null }) {
  const json = await apiCall({ action:'getBlocks', page_id, block_id });
  return json.results || [];
}

// Render a single block (returns HTMLElement)
async function renderBlock(b) {
  let el;  

  switch (b.type) {
    // ─── Paragraph ───────────────────────────────────────
    case 'paragraph': {
      el = document.createElement('p');
      el.textContent = b.paragraph.rich_text
        .map(rt => rt.plain_text)
        .join('');
      break;
    }

    // ─── Headings ────────────────────────────────────────
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const lvl = b.type.split('_')[1];
      el = document.createElement(`h${lvl}`);
      el.textContent = b[b.type].rich_text
        .map(rt => rt.plain_text)
        .join('');
      break;
    }

    // ─── Lists ────────────────────────────────────────────
    case 'bulleted_list_item':
    case 'numbered_list_item': {
      const tag = b.type === 'bulleted_list_item' ? 'li' : 'li';
      el = document.createElement(tag);
      el.textContent = b[b.type].rich_text
        .map(rt => rt.plain_text)
        .join('');
      break;
    }

    // ─── To-Do ────────────────────────────────────────────
    case 'to_do': {
      el = document.createElement('label');
      el.className = 'to-do';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = b.to_do.checked;
      cb.disabled = true;
      el.append(cb, ' ' + b.to_do.rich_text.map(rt => rt.plain_text).join(''));
      break;
    }

    // ─── Toggle ──────────────────────────────────────────
    case 'toggle': {
      el = document.createElement('details');
      el.className = 'block toggle';
      const sum = document.createElement('summary');
      sum.textContent = b.toggle.rich_text.map(rt => rt.plain_text).join('');
      el.append(sum);
      if (b.has_children) {
        const kids = await fetchBlocks({ block_id: b.id });
        for (const kb of kids) {
          el.append(await renderBlock(kb));
        }
      }
      break;
    }

    // ─── Callout ─────────────────────────────────────────
    case 'callout': {
      el = document.createElement('aside');
      el.className = 'callout';
      const icon = document.createElement('span');
      icon.className = 'callout-icon';
      icon.textContent = b.callout.icon?.emoji || '💡';
      const txt = document.createElement('div');
      txt.className = 'callout-content';
      txt.textContent = b.callout.rich_text.map(rt => rt.plain_text).join('');
      el.append(icon, txt);
      break;
    }

    // ─── Image ───────────────────────────────────────────
    case 'image': {
      el = document.createElement('img');
      const imgObj = b.image[b.image.type];
      el.src = imgObj.url;
      el.alt = b.image.caption[0]?.plain_text || '';
      break;
    }

    // ─── Embed & Media ───────────────────────────────────
    case 'embed': {
      el = document.createElement('iframe');
      el.src = b.embed.url;
      el.setAttribute('frameborder', '0');
      break;
    }
    case 'video': {
      el = document.createElement('video');
      el.controls = true;
      el.src = b.video[b.video.type].url;
      break;
    }
    case 'audio': {
      el = document.createElement('audio');
      el.controls = true;
      el.src = b.audio[b.audio.type].url;
      break;
    }

    // ─── Bookmark ────────────────────────────────────────
    case 'bookmark': {
      el = document.createElement('a');
      el.href = b.bookmark.url;
      el.target = '_blank';
      el.textContent = b.bookmark.caption[0]?.plain_text || b.bookmark.url;
      break;
    }

    // ─── Table ───────────────────────────────────────────
    case 'table': {
      const rows = await fetchBlocks({ block_id: b.id });
      el = document.createElement('table');
      if (rows.length) {
        // Header
        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        rows[0].table_row.cells.forEach(cell => {
          const th = document.createElement('th');
          th.textContent = cell.map(rt => rt.plain_text).join('');
          trh.append(th);
        });
        thead.append(trh);
        el.append(thead);
        // Body
        const tbody = document.createElement('tbody');
        rows.slice(1).forEach(r => {
          const tr = document.createElement('tr');
          r.table_row.cells.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell.map(rt => rt.plain_text).join('');
            tr.append(td);
          });
          tbody.append(tr);
        });
        el.append(tbody);
      }
      break;
    }

    // ─── Columns (layout) ─────────────────────────────────
    case 'column_list': {
      el = document.createElement('div');
      el.className = 'column-list';
      if (b.has_children) {
        const cols = await fetchBlocks({ block_id: b.id });
        for (const col of cols) {
          el.append(await renderBlock(col));
        }
      }
      break;
    }
    case 'column': {
      el = document.createElement('div');
      el.className = 'column';
      if (b.has_children) {
        const kids = await fetchBlocks({ block_id: b.id });
        for (const kb of kids) {
          el.append(await renderBlock(kb));
        }
      }
      break;
    }

    // ─── Child Page ───────────────────────────────────────
    case 'child_page': {
      el = document.createElement('a');
      el.href = `?page_id=${b.id}`;
      el.className = 'child-page';
      el.textContent = '📄 ' + b.child_page.title;
      break;
    }

    // ─── Child Database ───────────────────────────────────
   case 'child_database': {
  // 1) Query database
  const dbId = b.child_database.id;
  const json = await apiCall({
    action: 'queryDatabase',
    database_id: dbId
  });

  // 2) Ambil daftar kolom sesuai urutan di Notion
  const props = json.properties;                    // object keyed by name
  const colOrder = Object.keys(props).map(name => {
    return { name, type: props[name].type };
  });

  // 3) Buat tabel
  const table = document.createElement('table');
  table.className = 'notion-table-view';

  // 3a) THEAD
  const thead = document.createElement('thead');
  const trh   = document.createElement('tr');
  colOrder.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.name;
    trh.append(th);
  });
  thead.append(trh);
  table.append(thead);

  // 3b) TBODY
  const tbody = document.createElement('tbody');
  (json.results || []).forEach(rec => {
    const tr = document.createElement('tr');
    colOrder.forEach(col => {
      const td = document.createElement('td');
      const cell = rec.properties[col.name];
      // format berdasarkan tipe
      switch (col.type) {
        case 'title':
          td.textContent = cell.title[0]?.plain_text || '';
          break;
        case 'rich_text':
          td.textContent = cell.rich_text[0]?.plain_text || '';
          break;
        case 'date':
          td.textContent = cell.date?.start
            ? new Date(cell.date.start).toLocaleDateString()
            : '';
          td.className = 'date-cell';
          break;
        case 'select':
          td.textContent = cell.select?.name || '';
          td.className = 'select-pill';
          break;
        case 'multi_select':
          cell.multi_select.forEach(ms => {
            const span = document.createElement('span');
            span.textContent = ms.name;
            span.className = 'select-pill';
            td.append(span);
          });
          break;
        case 'checkbox':
          td.innerHTML = cell.checkbox ? '✔️' : '';
          break;
        default:
          // fallback plain
          td.textContent = (cell.plain_text || cell.email || '') + '';
      }
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);

  el = table;
  break;
}


    // ─── Fallback for unsupported blocks ──────────────────
    default: {
      if (b.has_children) {
        // Render children if any
        el = document.createElement('div');
        el.className = 'children';
        const kids = await fetchBlocks({ block_id: b.id });
        for (const kb of kids) {
          el.append(await renderBlock(kb));
        }
      } else {
        // Empty placeholder
        el = document.createElement('div');
        el.className = 'unsupported';
        el.textContent = '';
      }
    }
  } // end switch

  return el;
}


// Render full page content
async function renderPage(pageId) {
  // 1. Ambil judul page untuk breadcrumb
  const title = await fetchPageTitle(pageId);

  // Tampilkan breadcrumb
  document.getElementById('breadcrumb').innerHTML =
    `<a href="?page_id=${ROOT_PAGE_ID}">Home</a> › ${title}`;

  // Reset konten utama
  const content = document.getElementById('content');
  content.innerHTML = '';

  // 2. Fetch semua block children
  const blocks = await fetchBlocks({ page_id: pageId });

  // 3. Render callout (hanya satu, jika ada)
  const calloutBlock = blocks.find(b => b.type === 'callout');
  if (calloutBlock) {
    const calloutEl = await renderBlock(calloutBlock);
    const wrapper = document.createElement('div');
    wrapper.className = 'callout-wrapper';
    wrapper.append(calloutEl);
    content.append(wrapper);
  }

  // 4. Render setiap child_database sebagai tabel
  for (const dbBlock of blocks.filter(b => b.type === 'child_database')) {
    const dbTable = await renderBlock(dbBlock);
    // wrap agar jelas terpisah
    const dbWrapper = document.createElement('div');
    dbWrapper.className = 'db-wrapper';
    dbWrapper.append(dbTable);
    content.append(dbWrapper);
  }

  // 5. Render blok–blok lain (exclude callout + child_database)
  let listBuffer = null;
  let listType = null;

  for (const b of blocks) {
    // skip callout & child_database, sudah di-render
    if (b.type === 'callout' || b.type === 'child_database') {
      // reset any open list
      listBuffer = null; listType = null;
      continue;
    }

    // grouping list items
    if (b.type === 'bulleted_list_item' || b.type === 'numbered_list_item') {
      const tag = b.type === 'bulleted_list_item' ? 'ul' : 'ol';
      if (!listBuffer || listType !== tag) {
        listType = tag;
        listBuffer = document.createElement(tag);
        content.append(listBuffer);
      }
      listBuffer.append(await renderBlock(b));
    } else {
      // normal block → close any open list first
      listBuffer = null; listType = null;
      content.append(await renderBlock(b));
    }
  }
}


// Render dashboard (home)
function renderDashboard() {
  document.getElementById('breadcrumb').innerHTML =
    `<a href="?page_id=${ROOT_PAGE_ID}">Home</a>`;
  const main = document.getElementById('content');
  main.innerHTML = `<div class="grid"></div>`;
  const grid = main.querySelector('.grid');
  // modules data (title, icon, page_id) — isi sesuai
  const modules = [
      { title: 'Project Management', icon: 'icons/project.png', page_id: '20095552-6aa5-81ec-b880-ee143a748cbf' },
      { title: 'Asset Integrity', icon: 'icons/asset.png', page_id: '20895552-6aa5-808b-878c-d4027b0545ea' },
      { title: 'Engineering Departement', icon: 'icons/engineer.png', page_id: '20095552-6aa5-8145-a477-e38493673fed' },
      { title: 'Procurement Department', icon: 'icons/proc.png', page_id: '20095552-6aa5-8128-923f-fca68fcfc5f5' },
      { title: 'HR & Manpower', icon: 'icons/hr.png', page_id: '20095552-6aa5-81ca-84f2-f82f18d694a2' },
      { title: 'HSE Department', icon: 'icons/hse.png', page_id: '20095552-6aa5-81fa-8edb-d17153921690' },
      { title: 'QA/QC Department', icon: 'icons/qa.png', page_id: '20095552-6aa5-8133-bf84-ce7896a5dac7' },
      { title: 'Cost & Finance', icon: 'icons/cost.png', page_id: '20095552-6aa5-810d-8127-c99a10240d89' },
  ];
  modules.forEach(m=>{
    const card = document.createElement('div');
    card.className='card';
    card.onclick = ()=> renderPage(m.page_id);
    const img = document.createElement('img');
    img.src = m.icon; img.alt = m.title;
    const lbl = document.createElement('div');
    lbl.className='label'; lbl.textContent = m.title;
    card.append(img,lbl);
    grid.append(card);
  });
}

// On load
(async () => {
  const pid = new URLSearchParams(window.location.search).get('page_id') || ROOT_PAGE_ID;
  if (pid === ROOT_PAGE_ID) renderDashboard();
  else await renderPage(pid);
})();
