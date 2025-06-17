// api/proxy.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { action, page_id, block_id } = req.body;
    let url, opts;

    // Common headers
    const headers = {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version':   '2022-06-28',
      'Content-Type':    'application/json',
    };

    if (action === 'getPage') {
      // 1) Ambil metadata page utk judul/breadcrumb
      url = `https://api.notion.com/v1/pages/${page_id}`;
      opts = { method: 'GET', headers };
    } else {
      // Default = getBlocks (anak2 blok)
      const id = block_id || page_id;
      url = `https://api.notion.com/v1/blocks/${id}/children`;
      opts = { method: 'GET', headers };
    }

    const apiRes = await fetch(url, opts);
    const data   = await apiRes.json();
    return res
      .status(apiRes.status)
      .json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
}
