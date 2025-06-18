// api/proxy.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Hanya terima POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, page_id, block_id, database_id } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    // Setup CORS (opsional, hapus jika tidak diperlukan)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const headers = {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    let url, opts;

    switch (action) {
      case 'getPage':
        if (!page_id) throw new Error('page_id is required for getPage');
        url  = `https://api.notion.com/v1/pages/${page_id}`;
        opts = { method: 'GET', headers };
        break;

      case 'getBlocks':
        // bisa children of page atau of block
        const id = block_id || page_id;
        if (!id) throw new Error('page_id or block_id is required for getBlocks');
        url  = `https://api.notion.com/v1/blocks/${id}/children`;
        opts = { method: 'GET', headers };
        break;

      case 'queryDatabase':
        if (!database_id) throw new Error('database_id is required for queryDatabase');
        url  = `https://api.notion.com/v1/databases/${database_id}/query`;
        opts = { method: 'POST', headers, body: JSON.stringify({}) };
        break;

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    // Panggil Notion API
    const apiRes = await fetch(url, opts);
    const text   = await apiRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Invalid JSON from Notion' });
    }

    // Forward status code & JSON
    return res.status(apiRes.status).json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
