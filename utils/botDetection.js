export function detectBot(req) {
  const userAgent = req.headers['user-agent'] || '';
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /headless/i,
    /phantom/i,
    /selenium/i
  ];
  
  // Check user agent
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    return true;
  }
  
  // Check for missing common headers
  if (!req.headers['accept'] || !req.headers['accept-language']) {
    return true;
  }
  
  // Check request frequency (simplified)
  // In production, implement proper rate limiting per IP
  
  return false;
}
