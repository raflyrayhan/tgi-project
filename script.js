// ───────────────────────────────────────────────────────────
// script.js – TGI ERP White-Label Notion Dashboard
// ───────────────────────────────────────────────────────────

/** 1. Constants & Helpers **/
const PROXY        = '/api/proxy';
const ROOT_PAGE_ID = '20895552-6aa5-8049-a7bc-ec16acd51067';  // already hyphenated

// Daftar modul (ubah page_id sesuai Notion)
const modules = [
  { title:'Project Management',      icon:'icons/project.png', page_id:'20095552-6aa5-81ec-b880-ee143a748cbf' },
  { title:'Asset Integrity',         icon:'icons/asset.png',   page_id:'20895552-6aa5-808b-878c-d4027b0545ea' },
  { title:'Engineering Departement', icon:'icons/engineer.png', page_id:'20095552-6aa5-8145-a477-e38493673fed' },
  { title:'Procurement Department',  icon:'icons/proc.png',    page_id:'20095552-6aa5-8128-923f-fca68fcfc5f5' },
  { title:'HR & Manpower',           icon:'icons/hr.png',      page_id:'20095552-6aa5-81ca-84f2-f82f18d694a2' },
  { title:'HSE Department',          icon:'icons/hse.png',     page_id:'20095552-6aa5-81fa-8edb-d17153921690' },
  { title:'QA/QC Department',        icon:'icons/qa.png',      page_id:'20095552-6aa5-8133-bf84-ce7896a5dac7' },
  { title:'Cost & Finance',          icon:'icons/cost.png',    page_id:'20095552-6aa5-810d-8127-c99a10240d89' }
];

/** Generic POST to /api/proxy */
async function apiCall(body) {
  const res = await fetch(PROXY, {
    method:  'POST',
    headers: { 'Content-Type':'application/json' },
    body:    JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${body.action} → ${res.status}`);
  return res.json();
}

/** Fetch page title for breadcrumb */
async function fetchPageTitle(pid) {
  const json = await apiCall({ action:'getPage', page_id:pid });
  return json.properties.title.title[0]?.plain_text || 'Untitled';
}

/** Fetch child blocks of a page or block */
async function fetchBlocks({ page_id=null, block_id=null }) {
  const json = await apiCall({
    action:   'getBlocks',
    page_id, block_id
  });
  return json.results || [];
}

/** Render one Notion block → HTMLElement */
async function renderBlock(b) {
  let el;
  switch (b.type) {
    case 'paragraph':
      el = document.createElement('p');
      el.textContent = b.paragraph.rich_text.map(t=>t.plain_text).join('');
      break;

    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const lvl = b.type.split('_')[1];
      el = document.createElement(`h${lvl}`);
      el.textContent = b[b.type].rich_text[0]?.plain_text || '';
      break;
    }

    case 'bulleted_list_item':
    case 'numbered_list_item':
      el = document.createElement('li');
      el.textContent = b[b.type].rich_text.map(t=>t.plain_text).join('');
      break;

    case 'to_do': {
      el = document.createElement('label');
      el.className = 'to-do';
      const cb = document.createElement('input');
      cb.type='checkbox'; cb.checked=b.to_do.checked; cb.disabled=true;
      el.append(cb, ' '+b.to_do.rich_text.map(t=>t.plain_text).join(''));
      break;
    }

    case 'toggle': {
      el = document.createElement('details');
      el.className = 'block toggle';
      const sum = document.createElement('summary');
      sum.textContent = b.toggle.rich_text.map(t=>t.plain_text).join('');
      el.append(sum);
      if (b.has_children) {
        const kids = await fetchBlocks({ block_id:b.id });
        for (let k of kids) el.append(await renderBlock(k));
      }
      break;
    }

    case 'callout': {
      el = document.createElement('aside');
      el.className = 'callout';
      const ico = document.createElement('span');
      ico.className='callout-icon';
      ico.textContent = b.callout.icon?.emoji||'💡';
      const txt = document.createElement('div');
      txt.className='callout-content';
      txt.textContent = b.callout.rich_text.map(t=>t.plain_text).join('');
      el.append(ico, txt);
      break;
    }

    case 'image':
      el = document.createElement('img');
      const imgObj = b.image[b.image.type];
      el.src = imgObj.url;
      el.alt = b.image.caption[0]?.plain_text||'';
      break;

    case 'embed':
      el = document.createElement('iframe');
      el.src = b.embed.url;
      el.setAttribute('frameborder','0');
      break;

    case 'child_page':
      el = document.createElement('a');
      el.href = `?page_id=${b.id}`;
      el.className = 'child-page';
      el.textContent = '📄 '+b.child_page.title;
      break;

    case 'child_database': {
      const db = await apiCall({
        action:'queryDatabase',
        database_id: b.child_database.id
      });
      // build table
      const cols = Object.keys(db.properties);
      el = document.createElement('table');
      el.className = 'notion-table-view';
      // header
      const thead = el.createTHead();
      const hrow = thead.insertRow();
      cols.forEach(c=>{
        const th=hrow.insertCell(); th.textContent=c;
      });
      // body
      const tbody = el.createTBody();
      (db.results||[]).forEach(rec=>{
        const row = tbody.insertRow();
        cols.forEach(c=>{
          const cell = rec.properties[c];
          const td = row.insertCell();
          switch(cell?.type) {
            case 'title':      td.textContent=cell.title[0]?.plain_text||''; break;
            case 'rich_text':  td.textContent=cell.rich_text[0]?.plain_text||''; break;
            case 'date':       td.textContent=cell.date?.start||''; break;
            case 'select':     td.textContent=cell.select?.name||''; break;
            case 'multi_select':
              cell.multi_select.forEach(ms=>{
                const pill=document.createElement('span');
                pill.className='select-pill';
                pill.textContent=ms.name;
                td.append(pill);
              });
              break;
            case 'checkbox':   td.innerHTML=cell.checkbox?'✔️':''; break;
            default:           td.textContent=cell.plain_text||'';
          }
        });
      });
      break;
    }

    default:
      el = document.createElement('div');
      el.className = 'unsupported';
  }

  return el;
}

/** Render a Notion sub-page */
async function renderPage(pageId) {
  const bf = document.getElementById('breadcrumb');
  const content = document.getElementById('content');
  bf.innerHTML = `<a href="?page_id=${ROOT_PAGE_ID}">Home</a> › …`;
  content.innerHTML = `<p class="loading">Loading…</p>`;

  try {
    const title = await fetchPageTitle(pageId);
    bf.innerHTML = `<a href="?page_id=${ROOT_PAGE_ID}">Home</a> › ${title}`;
    const blocks = await fetchBlocks({ page_id:pageId });
    content.innerHTML = '';

    // optional: render callout first
    blocks.filter(b=>b.type==='callout')
          .forEach(async b=>{
            const w = document.createElement('div');
            w.className='callout-wrapper';
            w.append(await renderBlock(b));
            content.append(w);
          });

    // render database tables
    for (let b of blocks.filter(b=>b.type==='child_database')) {
      const w=document.createElement('div');
      w.className='db-wrapper';
      w.append(await renderBlock(b));
      content.append(w);
    }

    // render rest, grouping lists
    let buf=null, t=null;
    for (let b of blocks) {
      if (b.type==='callout' || b.type==='child_database') continue;
      if (b.type==='bulleted_list_item'||b.type==='numbered_list_item') {
        const tag=b.type==='bulleted_list_item'?'ul':'ol';
        if (!buf||t!==tag) {
          buf = document.createElement(tag);
          content.append(buf);
          t = tag;
        }
        buf.append(await renderBlock(b));
      } else {
        buf=null; t=null;
        content.append(await renderBlock(b));
      }
    }

  } catch (err) {
    content.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

/** Render the Home Dashboard */
function renderDashboard() {
  document.getElementById('breadcrumb').innerHTML =
    `<a href="?page_id=${ROOT_PAGE_ID}">Home</a>`;
  const content = document.getElementById('content');
  content.innerHTML = `<div class="grid"></div>`;
  const grid = content.querySelector('.grid');

  modules.forEach(m=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick   = ()=> location.search=`?page_id=${m.page_id}`;
    card.style.cursor='pointer';

    const img = document.createElement('img');
    img.src = m.icon; img.alt = m.title;

    const lbl = document.createElement('div');
    lbl.className='label'; lbl.textContent=m.title;

    card.append(img, lbl);
    grid.append(card);
  });
}

/** Auto-init **/
(async()=>{
  const pid = new URLSearchParams(location.search).get('page_id')||ROOT_PAGE_ID;
  if (pid === ROOT_PAGE_ID) renderDashboard();
  else await renderPage(pid);
})();
