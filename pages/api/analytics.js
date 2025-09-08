import fs from 'fs';
import path from 'path';

// File-based analytics with enhanced metrics for freemium analysis
const ANALYTICS_DIR = path.join(process.cwd(), 'data', 'analytics');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit per file

// Ensure analytics directory exists
function ensureAnalyticsDir() {
  if (!fs.existsSync(ANALYTICS_DIR)) {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
  }
}

// Get current date string for file naming
function getCurrentDateString() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// Read analytics file for a specific date
function readAnalyticsFile(date) {
  const filePath = path.join(ANALYTICS_DIR, `analytics-${date}.json`);
  
  if (!fs.existsSync(filePath)) {
    return {
      date,
      users: {},
      sessions: {},
      questions: [],
      feedback: [],
      pageViews: [],
      features: {},
      summary: {
        totalUsers: 0,
        totalSessions: 0,
        totalQuestions: 0,
        totalPageViews: 0,
        rateLimitHits: 0
      }
    };
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading analytics file for ${date}:`, error);
    return readAnalyticsFile(date); // Return empty structure
  }
}

// Write analytics file
function writeAnalyticsFile(date, data) {
  ensureAnalyticsDir();
  const filePath = path.join(ANALYTICS_DIR, `analytics-${date}.json`);
  
  // Check file size limit
  const dataStr = JSON.stringify(data, null, 2);
  if (Buffer.byteLength(dataStr, 'utf8') > MAX_FILE_SIZE) {
    console.warn(`Analytics file for ${date} exceeds size limit`);
    // Archive old data and start fresh if needed
    archiveAnalyticsFile(date, data);
    return;
  }
  
  try {
    fs.writeFileSync(filePath, dataStr, 'utf8');
  } catch (error) {
    console.error(`Error writing analytics file for ${date}:`, error);
  }
}

// Archive large analytics files
function archiveAnalyticsFile(date, data) {
  const archivePath = path.join(ANALYTICS_DIR, 'archive', `analytics-${date}-archived.json`);
  
  if (!fs.existsSync(path.dirname(archivePath))) {
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  }
  
  try {
    fs.writeFileSync(archivePath, JSON.stringify(data), 'utf8');
    
    // Start fresh file with summary only
    const freshData = {
      date,
      users: {},
      sessions: {},
      questions: [],
      feedback: [],
      pageViews: [],
      features: {},
      summary: data.summary,
      archived: true
    };
    
    writeAnalyticsFile(date, freshData);
  } catch (error) {
    console.error(`Error archiving analytics file for ${date}:`, error);
  }
}

// Track user activity
function trackUser(analytics, fingerprint, timestamp) {
  if (!analytics.users[fingerprint]) {
    analytics.users[fingerprint] = {
      firstSeen: timestamp,
      lastSeen: timestamp,
      sessionCount: 0,
      questionCount: 0,
      pageViews: 0,
      features: [],
      language: 'english',
      totalSessionTime: 0
    };
    analytics.summary.totalUsers++;
  } else {
    analytics.users[fingerprint].lastSeen = timestamp;
  }
  
  return analytics.users[fingerprint];
}

// Track session
function trackSession(analytics, fingerprint, sessionId, timestamp, action = 'start') {
  if (!analytics.sessions[sessionId]) {
    analytics.sessions[sessionId] = {
      fingerprint,
      startTime: timestamp,
      endTime: null,
      pageViews: [],
      questionsAsked: 0,
      featuresUsed: [],
      language: 'english',
      duration: 0
    };
    
    analytics.users[fingerprint].sessionCount++;
    analytics.summary.totalSessions++;
  }
  
  if (action === 'end' || action === 'update') {
    analytics.sessions[sessionId].endTime = timestamp;
    analytics.sessions[sessionId].duration = 
      new Date(timestamp) - new Date(analytics.sessions[sessionId].startTime);
    
    analytics.users[fingerprint].totalSessionTime += analytics.sessions[sessionId].duration;
  }
  
  return analytics.sessions[sessionId];
}

// Generate session ID based on fingerprint and time window
function generateSessionId(fingerprint, timestamp) {
  const sessionWindow = 30 * 60 * 1000; // 30 minutes
  const sessionStart = Math.floor(new Date(timestamp).getTime() / sessionWindow) * sessionWindow;
  return `${fingerprint}-${sessionStart}`;
}

// Calculate user engagement metrics
function calculateEngagementMetrics(analytics) {
  const users = Object.values(analytics.users);
  const sessions = Object.values(analytics.sessions);
  
  const metrics = {
    averageSessionDuration: 0,
    averageQuestionsPerUser: 0,
    averagePageViewsPerSession: 0,
    returnUserRate: 0,
    powerUsers: 0, // Users hitting rate limits
    bounceRate: 0, // Single page sessions
    featureAdoption: {},
    languageDistribution: { english: 0, hindi: 0 }
  };
  
  if (sessions.length > 0) {
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    metrics.averageSessionDuration = totalDuration / sessions.length;
    
    const totalPageViews = sessions.reduce((sum, s) => sum + s.pageViews.length, 0);
    metrics.averagePageViewsPerSession = totalPageViews / sessions.length;
    
    const bounceSessions = sessions.filter(s => s.pageViews.length <= 1).length;
    metrics.bounceRate = bounceSessions / sessions.length;
  }
  
  if (users.length > 0) {
    const totalQuestions = users.reduce((sum, u) => sum + u.questionCount, 0);
    metrics.averageQuestionsPerUser = totalQuestions / users.length;
    
    const returnUsers = users.filter(u => u.sessionCount > 1).length;
    metrics.returnUserRate = returnUsers / users.length;
    
    metrics.powerUsers = users.filter(u => u.questionCount >= 3).length;
    
    // Language distribution
    users.forEach(u => {
      metrics.languageDistribution[u.language]++;
    });
  }
  
  // Feature adoption
  analytics.pageViews.forEach(pv => {
    const feature = pv.page.split('/')[1] || 'home';
    metrics.featureAdoption[feature] = (metrics.featureAdoption[feature] || 0) + 1;
  });
  
  return metrics;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    action, 
    fingerprint, 
    sessionId: providedSessionId,
    timestamp = new Date().toISOString(),
    ...data 
  } = req.body;

  const today = getCurrentDateString();
  const analytics = readAnalyticsFile(today);
  
  // Generate session ID if not provided
  const sessionId = providedSessionId || generateSessionId(fingerprint, timestamp);

  try {
    switch (action) {
      case 'page_view':
        // Track page views and sessions
        trackUser(analytics, fingerprint, timestamp);
        const session = trackSession(analytics, fingerprint, sessionId, timestamp, 'update');
        
        const pageView = {
          timestamp,
          fingerprint,
          sessionId,
          page: data.page || '/',
          referrer: data.referrer || '',
          userAgent: data.userAgent || '',
          language: data.language || 'english'
        };
        
        analytics.pageViews.push(pageView);
        session.pageViews.push(pageView);
        analytics.users[fingerprint].pageViews++;
        analytics.users[fingerprint].language = data.language || 'english';
        analytics.summary.totalPageViews++;
        
        // Track feature usage
        const feature = data.page?.split('/')[1] || 'home';
        if (!analytics.features[feature]) {
          analytics.features[feature] = { views: 0, uniqueUsers: new Set() };
        }
        analytics.features[feature].views++;
        analytics.features[feature].uniqueUsers.add(fingerprint);
        
        break;

      case 'question_asked':
        trackUser(analytics, fingerprint, timestamp);
        const questionSession = trackSession(analytics, fingerprint, sessionId, timestamp, 'update');
        
        const question = {
          timestamp,
          fingerprint,
          sessionId,
          topic: data.topic,
          questionLength: data.questionLength,
          language: data.language || 'english',
          hasResults: data.hasResults !== false,
          similarityScore: data.similarityScore || null
        };
        
        analytics.questions.push(question);
        questionSession.questionsAsked++;
        analytics.users[fingerprint].questionCount++;
        analytics.users[fingerprint].language = data.language || 'english';
        analytics.summary.totalQuestions++;
        
        break;

      case 'feedback':
        const feedback = {
          timestamp,
          fingerprint,
          sessionId,
          helpful: data.helpful,
          topic: data.topic || null,
          language: data.language || 'english'
        };
        
        analytics.feedback.push(feedback);
        break;

      case 'rate_limit_hit':
        analytics.summary.rateLimitHits++;
        
        // Mark user as power user
        if (analytics.users[fingerprint]) {
          analytics.users[fingerprint].hitRateLimit = true;
          analytics.users[fingerprint].rateLimitHits = 
            (analytics.users[fingerprint].rateLimitHits || 0) + 1;
        }
        break;

      case 'session_end':
        trackSession(analytics, fingerprint, sessionId, timestamp, 'end');
        break;

      case 'feature_usage':
        // Track specific feature interactions
        trackUser(analytics, fingerprint, timestamp);
        
        const featureName = data.feature;
        if (!analytics.features[featureName]) {
          analytics.features[featureName] = { 
            uses: 0, 
            uniqueUsers: new Set(),
            interactions: []
          };
        }
        
        analytics.features[featureName].uses++;
        analytics.features[featureName].uniqueUsers.add(fingerprint);
        analytics.features[featureName].interactions.push({
          timestamp,
          fingerprint,
          action: data.action || 'use'
        });
        
        // Add to user's feature list
        if (!analytics.users[fingerprint].features.includes(featureName)) {
          analytics.users[fingerprint].features.push(featureName);
        }
        
        break;

      case 'get_stats':
        // Admin endpoint - return comprehensive analytics
        const dateRange = data.dateRange || 7; // Default to last 7 days
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (dateRange * 24 * 60 * 60 * 1000));
        
        const stats = {
          summary: analytics.summary,
          engagementMetrics: calculateEngagementMetrics(analytics),
          topicBreakdown: {},
          dailyStats: [],
          featureStats: {},
          userSegments: {
            new: 0,
            returning: 0,
            power: 0
          }
        };
        
        // Topic breakdown
        analytics.questions.forEach(q => {
          stats.topicBreakdown[q.topic] = (stats.topicBreakdown[q.topic] || 0) + 1;
        });
        
        // Feature statistics
        Object.keys(analytics.features).forEach(feature => {
          stats.featureStats[feature] = {
            views: analytics.features[feature].views,
            uniqueUsers: analytics.features[feature].uniqueUsers.size,
            avgUsagePerUser: analytics.features[feature].views / analytics.features[feature].uniqueUsers.size
          };
        });
        
        // User segments
        Object.values(analytics.users).forEach(user => {
          if (user.sessionCount === 1) {
            stats.userSegments.new++;
          } else if (user.sessionCount > 1) {
            stats.userSegments.returning++;
          }
          
          if (user.questionCount >= 3 || user.hitRateLimit) {
            stats.userSegments.power++;
          }
        });
        
        // Multi-day stats if requested
        if (dateRange > 1) {
          const dailyFiles = [];
          for (let i = 0; i < dateRange; i++) {
            const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
            const dateStr = date.toISOString().split('T')[0];
            
            try {
              const dayData = readAnalyticsFile(dateStr);
              dailyFiles.push({
                date: dateStr,
                summary: dayData.summary,
                engagement: calculateEngagementMetrics(dayData)
              });
            } catch (error) {
              // Skip missing days
            }
          }
          stats.dailyStats = dailyFiles;
        }
        
        res.status(200).json(stats);
        return;

      case 'get_freemium_insights':
        // Special endpoint for freemium decision metrics
        const insights = {
          userValueSignals: {
            rateLimitHitters: analytics.summary.rateLimitHits,
            multiSessionUsers: Object.values(analytics.users).filter(u => u.sessionCount > 1).length,
            highEngagementUsers: Object.values(analytics.users).filter(u => u.questionCount >= 2 && u.sessionCount >= 2).length,
            featureExplorers: Object.values(analytics.users).filter(u => u.features.length >= 2).length
          },
          conversionReadiness: {
            totalUsers: analytics.summary.totalUsers,
            powerUserPercentage: (Object.values(analytics.users).filter(u => u.questionCount >= 3).length / analytics.summary.totalUsers) * 100,
            averageQuestionsPerUser: analytics.summary.totalQuestions / analytics.summary.totalUsers,
            returnRate: (Object.values(analytics.users).filter(u => u.sessionCount > 1).length / analytics.summary.totalUsers) * 100
          },
          featurePopularity: Object.fromEntries(
            Object.entries(analytics.features).map(([name, data]) => [
              name, 
              { 
                usage: data.views, 
                adoption: (data.uniqueUsers.size / analytics.summary.totalUsers) * 100 
              }
            ])
          ),
          engagementMetrics: calculateEngagementMetrics(analytics)
        };
        
        res.status(200).json(insights);
        return;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Convert Sets to Arrays for JSON serialization
    Object.keys(analytics.features).forEach(feature => {
      if (analytics.features[feature].uniqueUsers instanceof Set) {
        analytics.features[feature].uniqueUsers = Array.from(analytics.features[feature].uniqueUsers);
      }
    });
    
    // Write updated analytics
    writeAnalyticsFile(today, analytics);
    
    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Analytics processing failed' });
  }
}