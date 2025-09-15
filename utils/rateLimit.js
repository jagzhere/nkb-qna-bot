// Vercel-compatible rate limiting using environment persistence
const limits = new Map();

// Simple cleanup function to remove old entries
function cleanupOldEntries() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toDateString();
  
  for (const [key, value] of limits.entries()) {
    if (key.includes(yesterdayString)) {
      limits.delete(key);
    }
  }
}

export function checkRateLimit(fingerprint, ip) {
  // Clean up old entries periodically
  if (Math.random() < 0.1) { // 10% chance to cleanup
    cleanupOldEntries();
  }
  
  const today = new Date().toDateString();
  const fingerprintKey = `${fingerprint}-${today}`;
  const ipKey = `${ip}-${today}`;
  
  const fingerprintCount = limits.get(fingerprintKey) || 0;
  const ipCount = limits.get(ipKey) || 0;
  
  console.log(`Rate check: Fingerprint ${fingerprint.substring(0,8)} has ${fingerprintCount}/3, IP has ${ipCount}/3`);
  
  // Block if either fingerprint OR IP has exceeded limit
  if (fingerprintCount >= 3 || ipCount >= 3) {
    console.log(`RATE LIMIT EXCEEDED for ${fingerprint.substring(0,8)}`);
    return { 
      allowed: false, 
      remaining: 0 
    };
  }
  
  // Update counts
  limits.set(fingerprintKey, fingerprintCount + 1);
  limits.set(ipKey, ipCount + 1);
  
  const remaining = Math.min(3 - (fingerprintCount + 1), 3 - (ipCount + 1));
  
  console.log(`Rate limit updated: ${fingerprint.substring(0,8)} now ${fingerprintCount + 1}/3`);
  
  return { 
    allowed: true, 
    remaining: remaining
  };
}
