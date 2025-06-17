// api/proxy.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { action, page_id, block_id, database_id } = req.body;
    const headers = {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version':   '2022-06-28',
      'Content-Type':    'application/json',
    };
    let url, opts;

    if (action === 'getPage') {
      url = `https://api.notion.com/v1/pages/${page_id}`;
      opts = { method:'GET', headers };
    }
    else if (action === 'getBlocks') {
      const id = block_id || page_id;
      url = `https://api.notion.com/v1/blocks/${id}/children`;
      opts = { method:'GET', headers };
    }
    else if (action === 'queryDatabase') {
      url = `https://api.notion.com/v1/databases/${database_id}/query`;
      opts = { method:'POST', headers, body: JSON.stringify({}) };
    }
    else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    const apiRes = await fetch(url, opts);
    const data   = await apiRes.json();
    return res.status(apiRes.status).json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
