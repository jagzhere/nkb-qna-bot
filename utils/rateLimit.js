// In-memory rate limiting (for production, use Redis or database)
const limits = new Map();

export function checkRateLimit(fingerprint, ip) {
  const today = new Date().toDateString();
  const fingerprintKey = `${fingerprint}-${today}`;
  const ipKey = `${ip}-${today}`;
  
  const fingerprintCount = limits.get(fingerprintKey) || 0;
  const ipCount = limits.get(ipKey) || 0;
  
  // Block if either fingerprint OR IP has exceeded limit
  if (fingerprintCount >= 3 || ipCount >= 3) {
    return { 
      allowed: false, 
      remaining: 0 
    };
  }
  
  // Update counts FIRST
  limits.set(fingerprintKey, fingerprintCount + 1);
  limits.set(ipKey, ipCount + 1);
  
  // Calculate remaining AFTER incrementing
  const newFingerprintCount = fingerprintCount + 1;
  const newIpCount = ipCount + 1;
  
  return { 
    allowed: true, 
    remaining: Math.min(3 - newFingerprintCount, 3 - newIpCount)
  };
}
