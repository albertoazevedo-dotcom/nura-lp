export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, email, cargo, empresa, produto, contexto } = req.body;
  if (!nome || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });

  const PORTAL_ID = '50947681';
  const FORM_GUID = 'a1d952ec-0932-4988-9e54-f091d751ce44';

  const fields = [
    { name: 'firstname', value: nome.split(' ')[0] },
    { name: 'lastname',  value: nome.split(' ').slice(1).join(' ') || '' },
    { name: 'email',     value: email },
    { name: 'jobtitle',  value: cargo || '' },
    { name: 'company',   value: empresa || '' },
    { name: 'message',   value: [produto ? `Solução: ${produto}` : '', contexto || ''].filter(Boolean).join('\n') },
  ].filter(f => f.value);

  try {
    const hsRes = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields,
          context: { pageUri: 'https://nura-9fs3vi4ae-albertoazevedo-dotcoms-projects.vercel.app', pageName: 'Nura AI LP' },
        }),
      }
    );

    const data = await hsRes.json();
    if (!hsRes.ok) throw new Error(data.message || JSON.stringify(data.errors));
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('HubSpot error:', err);
    return res.status(500).json({ error: err.message });
  }
}
