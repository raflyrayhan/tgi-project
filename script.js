// endpoint proxy (sesuaikan jika bukan Vercel/Netlify)
const PROXY = '/api/proxy';
const ROOT_PAGE_ID = '208955526aa58049a7bcec16acd51067'; // ganti dengan Page ID utama

/** Fetch children blocks */
async function fetchBlocks({ page_id=null, block_id=null }) {
  const res = await fetch(PROXY, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ page_id, block_id })
  });
  if(!res.ok) throw new Error('Fetch error '+res.status);
  const json = await res.json();
  return json.results;
}

/** Render one block element */
async function renderBlock(b) {
  let el;
  switch(b.type) {
    case 'paragraph':
      el = document.createElement('p');
      el.innerText = b.paragraph.rich_text.map(t=>t.plain_text).join('');
      break;
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const lvl = b.type.split('_')[1];
      el = document.createElement('h'+lvl);
      el.innerText = b[b.type].rich_text[0]?.plain_text || '';
      break;
    }
    case 'bulleted_list_item':
    case 'numbered_list_item':
      el = document.createElement('li');
      el.innerText = b[b.type].rich_text.map(t=>t.plain_text).join('');
      break;
    case 'to_do':
      el = document.createElement('label');
      el.className = 'to-do';
      const cb = document.createElement('input');
      cb.type='checkbox'; cb.checked=b.to_do.checked; cb.disabled=true;
      el.append(cb, ' '+b.to_do.rich_text.map(t=>t.plain_text).join(''));
      break;
    case 'toggle':
      el = document.createElement('details');
      el.className='block toggle';
      const summary = document.createElement('summary');
      summary.textContent = b.toggle.rich_text.map(t=>t.plain_text).join('');
      el.appendChild(summary);
      if(b.has_children) {
        const kids = await fetchBlocks({ block_id:b.id });
        for(const kb of kids) {
          el.appendChild(await renderBlock(kb));
        }
      }
      break;
    case 'callout':
      el = document.createElement('aside');
      el.className='callout';
      const ico = document.createElement('span');
      ico.className='callout-icon';
      ico.textContent = b.callout.icon?.emoji || '💡';
      const txt = document.createElement('div');
      txt.className='callout-content';
      txt.innerText = b.callout.rich_text.map(t=>t.plain_text).join('');
      el.append(ico, txt);
      break;
    case 'image':
      el = document.createElement('img');
      el.src = b.image[b.image.type].url;
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
      el.className='child-page';
      el.innerText = '📄 '+b.child_page.title;
      break;
    case 'child_database':
      el = document.createElement('iframe');
      el.src = `https://www.notion.so/${b.id.replace(/-/g,'')}`;
      el.setAttribute('frameborder','0');
      break;
    case 'table': {
      const rows = await fetchBlocks({ block_id:b.id });
      const table = document.createElement('table');
      if(rows.length) {
        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        rows[0].table_row.cells.forEach(c=>{
          const th = document.createElement('th');
          th.innerText = c.map(t=>t.plain_text).join('');
          trh.appendChild(th);
        });
        thead.appendChild(trh);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        rows.slice(1).forEach(r=>{
          const tr = document.createElement('tr');
          r.table_row.cells.forEach(c=>{
            const td = document.createElement('td');
            td.innerText = c.map(t=>t.plain_text).join('');
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      }
      el = table;
      break;
    }
    default:
      el = document.createElement('div');
      el.innerText = `[unsupported: ${b.type}]`;
  }
  return el;
}

/** Render full page */
async function loadPage(pid) {
  const content = document.getElementById('content');
  content.innerHTML='';
  // Breadcrumb
  const bc = document.getElementById('breadcrumb');
  bc.innerHTML = `<a href="?page_id=${ROOT_PAGE_ID}">Home</a> › ${pid}`;
  const blocks = await fetchBlocks({ page_id:pid });
  for(const b of blocks) {
    if(b.type==='bulleted_list_item' || b.type==='numbered_list_item') {
      let wrapTag = b.type==='bulleted_list_item'?'ul':'ol';
      let last = content.lastElementChild;
      if(!last || last.tagName.toLowerCase()!==wrapTag) {
        last = document.createElement(wrapTag);
        content.appendChild(last);
      }
      last.appendChild(await renderBlock(b));
    } else {
      content.appendChild(await renderBlock(b));
    }
  }
}

const params = new URLSearchParams(window.location.search);
const pageId = params.get('page_id')||ROOT_PAGE_ID;
loadPage(pageId).catch(e=>{
  document.getElementById('content').innerText = 'Error: '+e.message;
});
