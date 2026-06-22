export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, email, cargo, empresa, faturamento, produtos, contexto } = req.body;
  if (!nome || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });

  const SHEETS_URL   = process.env.SHEETS_URL;   // URL do Apps Script (webhook)
  const PORTAL_ID    = '50947681';
  const FORM_GUID    = 'a1d952ec-0932-4988-9e54-f091d751ce44';

  let sheetsOk  = false;
  let hubspotOk = false;

  // ── 1. Google Sheets (garantia principal) ─────────────────────────────────
  if (SHEETS_URL) {
    try {
      const sRes = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, cargo, empresa, faturamento, produtos, contexto }),
      });
      sheetsOk = sRes.ok;
      if (!sheetsOk) console.error('Sheets error:', await sRes.text());
    } catch (err) {
      console.error('Sheets fetch error:', err.message);
    }
  }

  // ── 2. HubSpot Contacts API v3 (se token disponível) ──────────────────────
  const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
  if (HUBSPOT_TOKEN) {
    try {
      const nomeParts = nome.trim().split(' ');
      const properties = {
        firstname:  nomeParts[0],
        lastname:   nomeParts.slice(1).join(' ') || '',
        email,
        jobtitle:   cargo    || '',
        company:    empresa  || '',
        message:    [
          faturamento ? `Faturamento: ${faturamento}` : '',
          contexto || '',
        ].filter(Boolean).join('\n\n'),
        produto_de_interesse: Array.isArray(produtos) ? produtos.join(';') : (produtos || ''),
        hs_lead_status: 'NEW',
      };

      const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties }),
      });

      if (createRes.status === 409) {
        // Contato já existe — atualiza
        const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
            limit: 1,
          }),
        });
        const { results } = await searchRes.json();
        if (results?.length) {
          await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${results[0].id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties }),
          });
        }
        hubspotOk = true;
      } else {
        hubspotOk = createRes.ok;
        if (!hubspotOk) console.error('HubSpot error:', await createRes.text());
      }
    } catch (err) {
      console.error('HubSpot fetch error:', err.message);
    }
  }

  // ── Resposta ──────────────────────────────────────────────────────────────
  // Considera sucesso se ao menos um dos destinos funcionou
  if (sheetsOk || hubspotOk) {
    return res.status(200).json({ success: true, sheets: sheetsOk, hubspot: hubspotOk });
  }

  // Se nenhum funcionou mas não há integração configurada, retorna ok (não bloqueia o lead)
  if (!SHEETS_URL && !HUBSPOT_TOKEN) {
    return res.status(200).json({ success: true, warning: 'Sem destino configurado' });
  }

  return res.status(500).json({ error: 'Falha ao salvar lead. Tente novamente.' });
}
