export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fingerprint, timestamp } = req.body;

  if (!fingerprint || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Simple bot detection checks
  const userAgent = req.headers['user-agent'] || '';
  const acceptHeader = req.headers['accept'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';

  // Check for common bot patterns
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /headless/i,
    /phantom/i,
    /selenium/i
  ];

  const isBot = botPatterns.some(pattern => pattern.test(userAgent));

  if (isBot) {
    return res.status(403).json({ 
      verified: false, 
      error: 'Bot detected' 
    });
  }

  // Check for missing headers that real browsers typically send
  if (!acceptHeader || !acceptLanguage) {
    return res.status(403).json({ 
      verified: false, 
      error: 'Missing browser headers' 
    });
  }

  // Check timestamp (should be recent)
  const now = Date.now();
  const timeDiff = Math.abs(now - timestamp);
  
  if (timeDiff > 60000) { // More than 1 minute old
    return res.status(403).json({ 
      verified: false, 
      error: 'Invalid timestamp' 
    });
  }

  // If all checks pass, verify as human
  res.status(200).json({ 
    verified: true,
    message: 'Human verification successful' 
  });
}
