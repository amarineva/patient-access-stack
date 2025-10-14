const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

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
      'http://localhost:5000', // Firebase Hosting emulator
      'http://127.0.0.1:5000', // Firebase Hosting emulator
      'http://localhost:8080', // Lightweight local testing server
      'http://127.0.0.1:8080'  // Lightweight local testing server
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

/**
 * Cloud Function to get MCP server state
 */
exports.getMcpState = onRequest(async (req, res) => {
  // Restrict CORS to only your domain
  const allowedOrigins = [
    'https://scriptability-patient-access.web.app',
    'https://scriptability-patient-access.firebaseapp.com',
    'http://localhost:5000', // Firebase Hosting emulator
    'http://127.0.0.1:5000', // Firebase Hosting emulator
    'http://localhost:8080', // Lightweight local testing server
    'http://127.0.0.1:8080'  // Lightweight local testing server
  ];
  
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  
  if (req.method === 'OPTIONS') {
    // Handle preflight
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  
  // Block requests from unauthorized origins
  if (origin && !allowedOrigins.includes(origin)) {
    res.status(403).json({ error: 'Forbidden: Invalid origin' });
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    // Use emulator if available
    const useEmulator = process.env.FIRESTORE_EMULATOR_HOST;
    if (useEmulator) {
      process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'scriptability-patient-access';
    }
    const db = admin.firestore();
    const doc = await db.collection('config').doc('mcp').get();
    
    if (!doc.exists) {
      // Default state: MCP server is enabled
      const defaultState = { enabled: true, lastUpdated: new Date().toISOString() };
      await db.collection('config').doc('mcp').set(defaultState);
      res.status(200).json(defaultState);
      return;
    }
    
    const data = doc.data();
    const enabled = typeof data.enabled === 'boolean' ? data.enabled : true;
    const lastUpdated = data.lastUpdated || new Date().toISOString();
    res.status(200).json({ enabled, lastUpdated });
    
  } catch (error) {
    console.error('Error getting MCP state:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Cloud Function to toggle MCP server state
 */
exports.toggleMcpState = onRequest(async (req, res) => {
  // Restrict CORS to only your domain
  const allowedOrigins = [
    'https://scriptability-patient-access.web.app',
    'https://scriptability-patient-access.firebaseapp.com',
    'http://localhost:5000', // Firebase Hosting emulator
    'http://127.0.0.1:5000', // Firebase Hosting emulator
    'http://localhost:8080', // Lightweight local testing server
    'http://127.0.0.1:8080'  // Lightweight local testing server
  ];
  
  const origin = req.headers.origin || '';
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
  if (origin && !allowedOrigins.includes(origin)) {
    res.status(403).json({ error: 'Forbidden: Invalid origin' });
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'Missing or invalid field: enabled (must be boolean)' });
      return;
    }

    const useEmulator = process.env.FIRESTORE_EMULATOR_HOST;
    if (useEmulator) {
      process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'scriptability-patient-access';
    }
    const db = admin.firestore();
    const newState = { 
      enabled, 
      lastUpdated: new Date().toISOString() 
    };
    
    await db.collection('config').doc('mcp').set(newState);
    
    res.status(200).json({
      success: true,
      enabled,
      lastUpdated: newState.lastUpdated,
      message: `MCP server ${enabled ? 'enabled' : 'disabled'} successfully`
    });
    
  } catch (error) {
    console.error('Error toggling MCP state:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Cloud Function to proxy MCP requests and check server state
 */
exports.mcpProxy = onRequest(async (req, res) => {
  // Restrict CORS to only your domain
  const allowedOrigins = [
    'https://scriptability-patient-access.web.app',
    'https://scriptability-patient-access.firebaseapp.com',
    'http://localhost:5000', // Firebase Hosting emulator
    'http://127.0.0.1:5000', // Firebase Hosting emulator
    'http://localhost:8080', // Lightweight local testing server
    'http://127.0.0.1:8080'  // Lightweight local testing server
  ];
  
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  
  if (req.method === 'OPTIONS') {
    // Handle preflight
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, mcp-protocol-version');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  
  // Block requests from unauthorized origins
  if (origin && !allowedOrigins.includes(origin)) {
    res.status(403).json({ error: 'Forbidden: Invalid origin' });
    return;
  }

  try {
    // Check MCP server state first
    const useEmulator = process.env.FIRESTORE_EMULATOR_HOST;
    if (useEmulator) {
      process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'scriptability-patient-access';
    }
    const db = admin.firestore();
    const doc = await db.collection('config').doc('mcp').get();
    
    let serverEnabled = true; // Default to enabled
    if (doc.exists) {
      const data = doc.data();
      serverEnabled = typeof data.enabled === 'boolean' ? data.enabled : true;
    }
    
    if (!serverEnabled) {
      res.status(503).json({ 
        error: 'MCP server is currently disabled',
        message: 'The MCP server has been disabled for security reasons. Please contact an administrator to enable it.',
        enabled: false
      });
      return;
    }

    // Forward the request to the actual MCP server
    const mcpServerUrl = 'https://scriptability-mcp-z4vamvc43a-uc.a.run.app';
    const originalUrl = req.originalUrl || '';
    let forwardedPath = '/mcp';
    const idx = originalUrl.indexOf('/mcp');
    if (idx >= 0) {
      forwardedPath = originalUrl.substring(idx);
    }
    const targetUrl = `${mcpServerUrl}${forwardedPath}`;
    
    const headers = { ...req.headers };
    delete headers.host; // Remove host header to avoid conflicts
    delete headers['content-length']; // Let fetch compute content-length
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    // Forward the response
    const responseData = await response.text();
    res.status(response.status);
    
    // Forward response headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding' && 
          key.toLowerCase() !== 'transfer-encoding' &&
          key.toLowerCase() !== 'connection') {
        res.set(key, value);
      }
    });
    
    res.send(responseData);
    
  } catch (error) {
    console.error('Error in MCP proxy:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});
