const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');

// Define the secret API key
const openaiApiKey = defineSecret('OPENAI_SIG_API_KEY');

/**
 * Cloud Function to proxy SIG Normalizer requests to OpenAI
 * This keeps the API key secure on the server side
 */
exports.normalizeSig = onRequest(
  {
    secrets: [openaiApiKey],
  },
  async (req, res) => {
    // Restrict CORS to only your domain
    const allowedOrigins = [
      'https://scriptability-patient-access.web.app',
      'https://scriptability-patient-access.firebaseapp.com',
      'http://localhost:5000', // For local testing
      'http://127.0.0.1:5000'  // For local testing
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    
    if (req.method === 'OPTIONS') {
      // Handle preflight
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }
    
    // Block requests from unauthorized origins
    if (!allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'Forbidden: Invalid origin' });
      return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' });
      return;
    }

    try {
      // Get the API key from the secret
      const apiKey = openaiApiKey.value();
      
      if (!apiKey) {
        console.error('OPENAI_SIG_API_KEY not configured');
        res.status(500).json({ error: 'API key not configured' });
        return;
      }

      // Extract the request body (passed from frontend)
      const requestBody = req.body;

      if (!requestBody || !requestBody.input) {
        res.status(400).json({ error: 'Missing required field: input' });
        return;
      }

      // Make the request to OpenAI
      const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', errorText);
        res.status(openaiResponse.status).json({ 
          error: `OpenAI API error: ${errorText}` 
        });
        return;
      }

      // Return the OpenAI response to the client
      const data = await openaiResponse.json();
      res.status(200).json(data);

    } catch (error) {
      console.error('Error in normalizeSig function:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
);
