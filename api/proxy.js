import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { page_id, block_id } = req.body;
    const id = block_id || page_id;
    const url = `https://api.notion.com/v1/blocks/${id}/children`;
    const apiRes = await fetch(url, {
      method:'GET',
      headers:{
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type':'application/json'
      }
    });
    const data = await apiRes.json();
    return res.status(apiRes.status).json(data);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
