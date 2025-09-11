import fs from 'fs';
import path from 'path';

// File-based rate limiting for Vercel
const RATE_LIMIT_FILE = path.join(process.cwd(), 'data', 'rate-limits.json');

function loadRateLimits() {
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      const data = fs.readFileSync(RATE_LIMIT_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading rate limits:', error);
  }
  return {};
}

function saveRateLimits(limits) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(RATE_LIMIT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(limits, null, 2));
  } catch (error) {
    console.error('Error saving rate limits:', error);
  }
}

function cleanOldEntries(limits) {
  const today = new Date().toDateString();
  const cleaned = {};
  
  for (const [key, value] of Object.entries(limits)) {
    if (key.includes(today)) {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

export function checkRateLimit(fingerprint, ip) {
  const today = new Date().toDateString();
  const fingerprintKey = `${fingerprint}-${today}`;
  const ipKey = `${ip}-${today}`;
  
  // Load current limits
  let limits = loadRateLimits();
  
  // Clean old entries
  limits = cleanOldEntries(limits);
  
  const fingerprintCount = limits[fingerprintKey] || 0;
  const ipCount = limits[ipKey] || 0;
  
  console.log(`Rate limit check: Fingerprint ${fingerprint} has ${fingerprintCount}/3, IP ${ip} has ${ipCount}/3`);
  
  // Block if either fingerprint OR IP has exceeded limit
  if (fingerprintCount >= 3 || ipCount >= 3) {
    console.log(`Rate limit exceeded for ${fingerprint}`);
    return { 
      allowed: false, 
      remaining: 0 
    };
  }
  
  // Update counts
  limits[fingerprintKey] = fingerprintCount + 1;
  limits[ipKey] = ipCount + 1;
  
  // Save updated limits
  saveRateLimits(limits);
  
  const remaining = Math.min(3 - (fingerprintCount + 1), 3 - (ipCount + 1));
  
  console.log(`Rate limit updated: ${fingerprint} now has ${fingerprintCount + 1}/3 questions used`);
  
  return { 
    allowed: true, 
    remaining: remaining
  };
}
