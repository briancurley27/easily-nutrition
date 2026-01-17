const getJsonBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY in environment.' });
    return;
  }

  try {
    const body = await getJsonBody(req);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';
    res.status(response.status).setHeader('Content-Type', contentType);
    res.send(responseText);
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    res.status(500).json({ error: 'Anthropic proxy failed.' });
  }
};
