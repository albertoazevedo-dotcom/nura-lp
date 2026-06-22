export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, email, cargo, empresa, faturamento, produtos, contexto } = req.body;
  if (!nome || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });

  const PORTAL_ID = '50947681';
  const FORM_GUID = 'a1d952ec-0932-4988-9e54-f091d751ce44';

  const nomeParts = nome.trim().split(' ');
  const firstname = nomeParts[0];
  const lastname  = nomeParts.slice(1).join(' ') || '';

  // Monta o campo message com todas as infos extras para garantir que chegam
  const messageLines = [];
  if (faturamento) messageLines.push(`Faturamento anual: ${faturamento}`);
  if (contexto)    messageLines.push(contexto);
  const messageValue = messageLines.join('\n\n');

  // Apenas propriedades de contato (0-1) — sem objectTypeId para máxima compatibilidade
  const fields = [
    { name: 'firstname', value: firstname },
    { name: 'lastname',  value: lastname  },
    { name: 'email',     value: email     },
  ];
  if (cargo)                fields.push({ name: 'jobtitle', value: cargo });
  if (empresa)              fields.push({ name: 'company',  value: empresa });
  if (messageValue)         fields.push({ name: 'message',  value: messageValue });
  if (produtos && produtos.length > 0) {
    const val = Array.isArray(produtos) ? produtos.join(';') : produtos;
    fields.push({ name: 'produto_de_interesse', value: val });
  }

  try {
    const hsRes = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submittedAt: Date.now().toString(),
          fields,
          context: {
            pageUri:  'https://nura-lp-theta.vercel.app',
            pageName: 'Nura AI — A inteligência que transforma o seu negócio',
          },
        }),
      }
    );

    const body = await hsRes.json();

    if (!hsRes.ok) {
      console.error('HubSpot error:', JSON.stringify(body));
      return res.status(400).json({
        error: body.message || 'HubSpot error',
        details: body.errors || body,
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
}
