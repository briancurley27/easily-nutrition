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

    // Log request details (sanitize messages for privacy)
    console.log('[Anthropic API] Request:', {
      model: body.model,
      max_tokens: body.max_tokens,
      tools: body.tools,
      message_preview: body.messages?.[0]?.content?.substring(0, 100) + '...'
    });

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

    // Log response details
    console.log('[Anthropic API] Response Status:', response.status);
    console.log('[Anthropic API] Response Preview:', responseText.substring(0, 500));

    // If error status, log full response
    if (!response.ok) {
      console.error('[Anthropic API] Error Response:', responseText);
    }

    res.status(response.status).setHeader('Content-Type', contentType);
    res.send(responseText);
  } catch (error) {
    console.error('[Anthropic proxy] Exception:', error.message);
    console.error('[Anthropic proxy] Stack:', error.stack);
    res.status(500).json({ error: 'Anthropic proxy failed.', details: error.message });
  }
};
