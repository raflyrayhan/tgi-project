// api/proxy.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1) Tangani preflight CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    // early return untuk preflight
    return res.status(204).end();
  }

  // 2) Hanya terima POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
  } catch (e) {
    console.error('⚠️ Invalid JSON body:', e.message);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { action, page_id, block_id, database_id } = body;
  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }

  // 3) Siapkan header Notion API
  const headers = {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  let url, opts;
  try {
    switch (action) {
      case 'getPage':
        if (!page_id) throw new Error('page_id is required for getPage');
        url  = `https://api.notion.com/v1/pages/${page_id}`;
        opts = { method: 'GET', headers };
        break;

      case 'getBlocks': {
        const id = block_id || page_id;
        if (!id) throw new Error('page_id or block_id is required for getBlocks');
        url  = `https://api.notion.com/v1/blocks/${id}/children`;
        opts = { method: 'GET', headers };
        break;
      }

      case 'queryDatabase':
        if (!database_id) throw new Error('database_id is required for queryDatabase');
        url  = `https://api.notion.com/v1/databases/${database_id}/query`;
        opts = { method: 'POST', headers, body: JSON.stringify({}) };
        break;

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    // 4) Panggil Notion API
    console.debug(`Proxy → Notion [${opts.method}]`, url);
    const apiRes = await fetch(url, opts);
    const text   = await apiRes.text();

    // 5) Coba parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('⚠️ Notion returned non-JSON:', text.slice(0, 200));
      return res.status(502).json({ error: 'Invalid JSON from Notion' });
    }

    // 6) Forward status code + JSON
    return res.status(apiRes.status).json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
