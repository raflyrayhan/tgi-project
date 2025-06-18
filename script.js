// ───────────────────────────────────────────────────────────
// script.js – White-label Notion → PT TGI ERP Dashboard
// ───────────────────────────────────────────────────────────
(() => {
  'use strict';

  // 1) Konstanta & Util Functions
  // ─────────────────────────────────
  const PROXY        = '/api/proxy';        // atau '/api/proxy.js'
  const RAW_ROOT_ID  = '20895552-6aa5-8049-a7bc-ec16acd51067';
  const ROOT_PAGE_ID = hyphenate(RAW_ROOT_ID);

  function hyphenate(raw) {
    const s = raw.replace(/-/g, '');
    return [
      s.slice(0,8), s.slice(8,12),
      s.slice(12,16), s.slice(16,20),
      s.slice(20)
    ].join('-');
  }

  // Generic proxy caller
  async function apiCall(body) {
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>'');
      throw new Error(`${body.action||'call'} failed: ${res.status}${txt?` – ${txt}`:''}`);
    }
    return res.json();
  }

  // 2) Fetch Helpers
  // ─────────────────────────────────
  async function fetchPageTitle(pageId) {
    const json = await apiCall({ action:'getPage', page_id:pageId });
    return json.properties?.title?.title?.[0]?.plain_text || 'Untitled';
  }

  async function fetchBlocks({ page_id=null, block_id=null }) {
    const json = await apiCall({ action:'getBlocks', page_id, block_id });
    return json.results || [];
  }

  // 3) Render a single Notion block → HTMLElement
  // ───────────────────────────────────────────────
  async function renderBlock(b) {
    try {
      let el;
      switch (b.type) {
        // Paragraph
        case 'paragraph': {
          el = document.createElement('p');
          el.textContent = b.paragraph.rich_text.map(rt=>rt.plain_text).join('');
          break;
        }
        // Headings (1–3)
        case 'heading_1': case 'heading_2': case 'heading_3': {
          const lvl = b.type.split('_')[1];
          el = document.createElement(`h${lvl}`);
          el.textContent = b[b.type].rich_text.map(rt=>rt.plain_text).join('');
          break;
        }
        // Lists
        case 'bulleted_list_item':
        case 'numbered_list_item': {
          el = document.createElement('li');
          el.textContent = b[b.type].rich_text.map(rt=>rt.plain_text).join('');
          break;
        }
        // To-Do
        case 'to_do': {
          el = document.createElement('label');
          el.className = 'to-do';
          const cb = document.createElement('input');
          cb.type='checkbox'; cb.checked=b.to_do.checked; cb.disabled=true;
          el.append(cb, ' '+b.to_do.rich_text.map(rt=>rt.plain_text).join(''));
          break;
        }
        // Toggle
        case 'toggle': {
          el = document.createElement('details');
          el.className = 'block toggle';
          const sum = document.createElement('summary');
          sum.textContent = b.toggle.rich_text.map(rt=>rt.plain_text).join('');
          el.append(sum);
          if (b.has_children) {
            const kids = await fetchBlocks({ block_id:b.id });
            for (let kid of kids) {
              el.append(await renderBlock(kid));
            }
          }
          break;
        }
        // Callout
        case 'callout': {
          el = document.createElement('aside');
          el.className = 'callout';
          const ico = document.createElement('span');
          ico.className='callout-icon';
          ico.textContent = b.callout.icon?.emoji||'💡';
          const txt = document.createElement('div');
          txt.className='callout-content';
          txt.textContent = b.callout.rich_text.map(rt=>rt.plain_text).join('');
          el.append(ico, txt);
          break;
        }
        // Image
        case 'image': {
          el = document.createElement('img');
          const imgObj = b.image[b.image.type];
          el.src = imgObj.url;
          el.alt = b.image.caption[0]?.plain_text||'';
          break;
        }
        // Embed / Video / Audio
        case 'embed': {
          el = document.createElement('iframe');
          el.src = b.embed.url;
          el.setAttribute('frameborder','0');
          break;
        }
        case 'video': {
          el = document.createElement('video');
          el.controls=true;
          el.src=b.video[b.video.type].url;
          break;
        }
        case 'audio': {
          el = document.createElement('audio');
          el.controls=true;
          el.src=b.audio[b.audio.type].url;
          break;
        }
        // Bookmark
        case 'bookmark': {
          el = document.createElement('a');
          el.href=b.bookmark.url; el.target='_blank';
          el.textContent=b.bookmark.caption[0]?.plain_text||b.bookmark.url;
          break;
        }
        // Table
        case 'table': {
          const rows = await fetchBlocks({ block_id:b.id });
          el = document.createElement('table');
          if (rows.length) {
            const thead = document.createElement('thead');
            const trh = document.createElement('tr');
            rows[0].table_row.cells.forEach(cell=>{
              const th=document.createElement('th');
              th.textContent=cell.map(rt=>rt.plain_text).join('');
              trh.append(th);
            });
            thead.append(trh); el.append(thead);
            const tbody=document.createElement('tbody');
            rows.slice(1).forEach(r=>{
              const tr=document.createElement('tr');
              r.table_row.cells.forEach(cell=>{
                const td=document.createElement('td');
                td.textContent=cell.map(rt=>rt.plain_text).join('');
                tr.append(td);
              });
              tbody.append(tr);
            });
            el.append(tbody);
          }
          break;
        }
        // Columns Layout
        case 'column_list': {
          el=document.createElement('div');
          el.className='column-list';
          if (b.has_children) {
            const cols=await fetchBlocks({ block_id:b.id });
            for (let c of cols) el.append(await renderBlock(c));
          }
          break;
        }
        case 'column': {
          el=document.createElement('div');
          el.className='column';
          if (b.has_children) {
            const kids=await fetchBlocks({ block_id:b.id });
            for (let k of kids) el.append(await renderBlock(k));
          }
          break;
        }
        // Child Page
        case 'child_page': {
          el=document.createElement('a');
          el.href=`?page_id=${b.id}`;
          el.className='child-page';
          el.textContent='📄 '+b.child_page.title;
          break;
        }
        // Child Database
        case 'child_database': {
          const dbJson = await apiCall({
            action:'queryDatabase',
            database_id:b.child_database.id
          });
          const props = dbJson.properties;
          const order = Object.keys(props).map(name=>({ name, type:props[name].type }));
          el=document.createElement('table');
          el.className='notion-table-view';
          // header
          const thead=document.createElement('thead');
          const trh=document.createElement('tr');
          order.forEach(col=>{
            const th=document.createElement('th');
            th.textContent=col.name; trh.append(th);
          });
          thead.append(trh); el.append(thead);
          // body
          const tbody=document.createElement('tbody');
          (dbJson.results||[]).forEach(rec=>{
            const tr=document.createElement('tr');
            order.forEach(col=>{
              const td=document.createElement('td');
              const cell=rec.properties[col.name]||{};
              switch(col.type) {
                case 'title':
                  td.textContent=cell.title?.[0]?.plain_text||''; break;
                case 'rich_text':
                  td.textContent=cell.rich_text?.[0]?.plain_text||''; break;
                case 'date':
                  td.textContent=cell.date?.start
                    ? new Date(cell.date.start).toLocaleDateString()
                    : ''; td.className='date-cell'; break;
                case 'select':
                  td.textContent=cell.select?.name||''; td.className='select-pill'; break;
                case 'multi_select':
                  (cell.multi_select||[]).forEach(ms=>{
                    const sp=document.createElement('span');
                    sp.className='select-pill';
                    sp.textContent=ms.name;
                    td.append(sp);
                  });
                  break;
                case 'checkbox':
                  td.innerHTML=cell.checkbox?'✔️':''; break;
                default:
                  td.textContent=String(cell.plain_text||cell.email||'');
              }
              tr.append(td);
            });
            tbody.append(tr);
          });
          el.append(tbody);
          break;
        }
        // Fallback
        default: {
          console.warn('Unsupported block type:', b.type);
          if (b.has_children) {
            el=document.createElement('div');
            el.className='children';
            const kids=await fetchBlocks({ block_id:b.id });
            for (let k of kids) el.append(await renderBlock(k));
          } else {
            el=document.createElement('div');
            el.className='unsupported';
          }
        }
      }
      return el;
    } catch (err) {
      console.error('renderBlock error', err, b);
      const errDiv = document.createElement('div');
      errDiv.className='block-error';
      errDiv.textContent = `[Error rendering block: ${b.type}]`;
      return errDiv;
    }
  }

  // 4) Render Sub-Page
  // ───────────────────────────────────────────────────────────
  async function renderPage(pageId) {
    const content = document.getElementById('content');
    content.innerHTML = '<p class="loading">Loading page…</p>';

    try {
      const title = await fetchPageTitle(pageId);
      document.getElementById('breadcrumb').innerHTML =
        `<a href="?page_id=${ROOT_PAGE_ID}">Home</a> › ${title}`;

      const blocks = await fetchBlocks({ page_id:pageId });
      content.innerHTML = '';  // clear loading

      // 1) Callout
      const callout = blocks.find(b=>b.type==='callout');
      if (callout) {
        const co = await renderBlock(callout);
        const wrap = document.createElement('div');
        wrap.className='callout-wrapper';
        wrap.append(co);
        content.append(wrap);
      }

      // 2) Child databases
      for (let b of blocks) {
        if (b.type==='child_database') {
          const tbl = await renderBlock(b);
          const wrap = document.createElement('div');
          wrap.className='db-wrapper';
          wrap.append(tbl);
          content.append(wrap);
        }
      }

      // 3) Sisanya
      let listBuf=null, listType=null;
      for (let b of blocks) {
        if (b.type==='callout'||b.type==='child_database') {
          listBuf=null; listType=null; continue;
        }
        if (b.type==='bulleted_list_item'||b.type==='numbered_list_item') {
          const tag = b.type==='bulleted_list_item'?'ul':'ol';
          if (!listBuf||listType!==tag) {
            listType=tag;
            listBuf=document.createElement(tag);
            content.append(listBuf);
          }
          listBuf.append(await renderBlock(b));
        } else {
          listBuf=null; listType=null;
          content.append(await renderBlock(b));
        }
      }
    } catch (err) {
      console.error('renderPage error', err);
      content.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
  }

  // 5) Render Dashboard
  // ───────────────────────────────────────────────────────────
  function renderDashboard() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = `<a href="?page_id=${ROOT_PAGE_ID}">Home</a>`;

    const main = document.getElementById('content');
    main.innerHTML = '<div class="grid loading">Loading modules…</div>';
    const grid = main.querySelector('.grid');

    const modules = [
      { title:'Project Management',      icon:'icons/project.png',      page_id:'20095552-6aa5-81ec-b880-ee143a748cbf' },
      { title:'Asset Integrity',         icon:'icons/asset.png',        page_id:'20895552-6aa5-808b-878c-d4027b0545ea' },
      { title:'Engineering Departement', icon:'icons/engineer.png',     page_id:'20095552-6aa5-8145-a477-e38493673fed' },
      { title:'Procurement Department',  icon:'icons/proc.png',         page_id:'20095552-6aa5-8128-923f-fca68fcfc5f5' },
      { title:'HR & Manpower',           icon:'icons/hr.png',           page_id:'20095552-6aa5-81ca-84f2-f82f18d694a2' },
      { title:'HSE Department',          icon:'icons/hse.png',          page_id:'20095552-6aa5-81fa-8edb-d17153921690' },
      { title:'QA/QC Department',        icon:'icons/qa.png',           page_id:'20095552-6aa5-8133-bf84-ce7896a5dac7' },
      { title:'Cost & Finance',          icon:'icons/cost.png',         page_id:'20095552-6aa5-810d-8127-c99a10240d89' }
    ];

    grid.innerHTML = ''; // clear loading
    modules.forEach(mod => {
      const link = document.createElement('a');
      link.href = `?page_id=${mod.page_id}`;
      link.className = 'card';
      link.setAttribute('role','button');
      link.style.cursor='pointer';

      const img = document.createElement('img');
      img.src=mod.icon; img.alt=mod.title;
      const lbl = document.createElement('div');
      lbl.className='label'; lbl.textContent=mod.title;

      link.append(img, lbl);
      grid.append(link);
    });
  }

  // 6) Global error handler
  window.addEventListener('error', e => {
    console.error('Uncaught error:', e.error);
    const content = document.getElementById('content');
    content.innerHTML = `<p class="error">Unexpected error: ${e.error?.message||e.message}</p>`;
  });

  // 7) Auto-init
  (async () => {
    const params = new URLSearchParams(location.search);
    const pid = params.get('page_id') || ROOT_PAGE_ID;
    if (pid === ROOT_PAGE_ID) {
      renderDashboard();
    } else {
      await renderPage(pid);
    }
  })();

})();  // end IIFE
