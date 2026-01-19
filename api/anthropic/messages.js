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

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY in environment.' });
    return;
  }

  try {
    const body = await getJsonBody(req);

    // Log request details (sanitize messages for privacy)
    console.log('[OpenAI API] Request:', {
      model: body.model,
      max_tokens: body.max_tokens,
      tools: body.tools,
      message_preview: body.messages?.[0]?.content?.substring(0, 100) + '...'
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';

    // Log response details
    console.log('[OpenAI API] Response Status:', response.status);
    console.log('[OpenAI API] Response Preview:', responseText.substring(0, 500));

    // If error status, log full response
    if (!response.ok) {
      console.error('[OpenAI API] Error Response:', responseText);
    }

    res.status(response.status).setHeader('Content-Type', contentType);
    res.send(responseText);
  } catch (error) {
    console.error('[OpenAI proxy] Exception:', error.message);
    console.error('[OpenAI proxy] Stack:', error.stack);
    res.status(500).json({ error: 'OpenAI proxy failed.', details: error.message });
  }
};
