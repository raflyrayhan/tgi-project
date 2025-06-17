// Endpoint proxy (sesuaikan jika path-nya berbeda)
const PROXY = '/api/proxy.js';
// ID halaman root (lengkap dengan dash)
const ROOT_PAGE_ID = '20895552-6aa5-8049-a7bc-ec16acd51067';

// Daftar modul: title, icon-url, dan page_id.
const modules = [
  { title: 'Project Management', icon: 'icons/project.png', page_id: '20095552-6aa5-81ec-b880-ee143a748cbf' },
  { title: 'Asset Integrity', icon: 'icons/operation.png', page_id: '20895552-6aa5-808b-878c-d4027b0545ea' },
  { title: 'Engineering Departement', icon: 'icons/engineering.png', page_id: '20095552-6aa5-8145-a477-e38493673fed' },
  { title: 'Procurement Department', icon: 'icons/procurement.png', page_id: '20095552-6aa5-8128-923f-fca68fcfc5f5' },
  { title: 'HR & Manpower', icon: 'icons/hr.png', page_id: '20095552-6aa5-81ca-84f2-f82f18d694a2' },
  { title: 'HSE Department', icon: 'icons/hse.png', page_id: '20095552-6aa5-81fa-8edb-d17153921690' },
  { title: 'QA/QC Department', icon: 'icons/qaqc.png', page_id: '20095552-6aa5-8133-bf84-ce7896a5dac7' },
  { title: 'Cost & Finance', icon: 'icons/cost.png', page_id: '20095552-6aa5-810d-8127-c99a10240d89' },
];

// Render breadcrumb
function renderBreadcrumb(pageId, pageTitle = 'Home') {
  const bc = document.getElementById('breadcrumb');
  bc.innerHTML = `<a href="?page_id=${ROOT_PAGE_ID}">${pageTitle}</a> › ${pageId}`;
}

// Fetch blocks (dipakai bila nanti ingin fetch konten detail sub-page)
async function fetchBlocks({ page_id = null, block_id = null }) {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_id, block_id })
  });
  if (!res.ok) throw new Error('Fetch error ' + res.status);
  const { results } = await res.json();
  return results;
}

// Tampilkan dashboard grid
function renderDashboard() {
  renderBreadcrumb(ROOT_PAGE_ID, 'Home');
  const container = document.getElementById('content');
  container.innerHTML = `<div class="grid"></div>`;
  const grid = container.querySelector('.grid');

  modules.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => loadPage(mod.page_id);

    const img = document.createElement('img');
    img.src = mod.icon;
    img.alt = mod.title;

    const label = document.createElement('a');
    label.className = 'label';
    label.textContent = mod.title;
    label.href = `?page_id=${mod.page_id}`;

    card.append(img, label);
    grid.append(card);
  });
}

// Load halaman detail modul (jika di-klik)
async function loadPage(pageId) {
  // Boleh tambahkan fitur fetch konten dengan fetchBlocks()
  // Untuk demo, kita kembalikan ke dashboard
  console.log('Load sub-page:', pageId);
  // Jika ingin render sub-page, panggil fungsi renderBlocks()
  // atau kembalikan dashboard:
  renderDashboard();
}

// Inisialisasi
const params = new URLSearchParams(window.location.search);
if (params.has('page_id') && params.get('page_id') !== ROOT_PAGE_ID) {
  // Jika ada page_id non-root, bisa panggil loadPage()
  loadPage(params.get('page_id'));
} else {
  renderDashboard();
}
