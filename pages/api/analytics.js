// pages/api/analytics.js - Working version for Vercel

// In-memory storage (resets on deployment but works for current sessions)
let analyticsData = {
  users: new Set(),
  questions: [],
  sessions: [],
  pageViews: [],
  features: {},
  feedback: [],
  rateLimitHits: 0
};

export default async function handler(req, res) {
  // Enable CORS for dashboard access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { action, fingerprint, timestamp = new Date().toISOString(), ...data } = req.body;
      
      console.log('Analytics POST received:', { action, fingerprint, data });

      switch (action) {
        case 'page_view':
          // Track user and page view
          analyticsData.users.add(fingerprint);
          analyticsData.pageViews.push({
            timestamp,
            fingerprint,
            page: data.page || '/',
            language: data.language || 'english'
          });
          break;

        case 'question_asked':
          // Track question
          analyticsData.users.add(fingerprint);
          analyticsData.questions.push({
            timestamp,
            fingerprint,
            topic: data.topic,
            language: data.language || 'english',
            hasResults: data.hasResults !== false,
            similarityScore: data.similarityScore
          });
          break;

        case 'question_asked':
  // Track question
  analyticsData.users.add(fingerprint);
  analyticsData.questions.push({
    timestamp,
    fingerprint,
    topic: data.topic,
    questionText: data.questionText, // ADD THIS LINE
    language: data.language || 'english',
    hasResults: data.hasResults !== false,
    similarityScore: data.similarityScore
  });
  break;

        case 'rate_limit_hit':
          analyticsData.rateLimitHits++;
          break;

        case 'feature_usage':
          const featureName = data.feature;
          if (!analyticsData.features[featureName]) {
            analyticsData.features[featureName] = { count: 0, users: new Set() };
          }
          analyticsData.features[featureName].count++;
          analyticsData.features[featureName].users.add(fingerprint);
          break;

        case 'feedback':
          analyticsData.feedback.push({
            timestamp,
            fingerprint,
            helpful: data.helpful,
            language: data.language || 'english'
          });
          break;

        case 'session_end':
          // Track session end
          analyticsData.sessions.push({
            timestamp,
            fingerprint,
            sessionId: data.sessionId
          });
          break;

        default:
          console.log('Unknown analytics action:', action);
      }

      return res.status(200).json({ success: true });

    } else if (req.method === 'GET') {
      const { action } = req.query;
      
      console.log('Analytics GET received:', { action, query: req.query });

      if (action === 'get_stats' || !action) {
        // Calculate stats for dashboard
        const totalUsers = analyticsData.users.size;
        const totalQuestions = analyticsData.questions.length;
        const totalSessions = analyticsData.sessions.length;
        const totalPageViews = analyticsData.pageViews.length;
        
        // Topic breakdown
        const topicBreakdown = {};
        analyticsData.questions.forEach(q => {
          topicBreakdown[q.topic] = (topicBreakdown[q.topic] || 0) + 1;
        });

        // Language preference
        const languagePreference = { english: 0, hindi: 0 };
        analyticsData.questions.forEach(q => {
          languagePreference[q.language]++;
        });

        const stats = {
          totalUsers,
          totalQuestions,
          totalSessions: Math.max(totalSessions, totalUsers), // At least 1 session per user
          rateLimitHits: analyticsData.rateLimitHits,
          pageViews: { 
            homepage: totalPageViews,
            dailyDarshan: 0, 
            guidedMeditation: 0 
          },
          topicDistribution: topicBreakdown,
          languagePreference,
          featureUsage: Object.fromEntries(
            Object.entries(analyticsData.features).map(([name, data]) => [
              name, 
              { uses: data.count, uniqueUsers: data.users.size }
            ])
          ),
         recentQuestions: analyticsData.questions.slice(-10).map(q => ({
          question: q.questionText,
          topic: q.topic,
          hasResults: q.hasResults,
          timestamp: q.timestamp
          }))
        };

        console.log('Returning stats:', stats);
        return res.status(200).json(stats);

      } else if (action === 'get_freemium_insights') {
        // Freemium analysis
        const userQuestionCounts = {};
        analyticsData.questions.forEach(q => {
          userQuestionCounts[q.fingerprint] = (userQuestionCounts[q.fingerprint] || 0) + 1;
        });

        const powerUsers = Object.values(userQuestionCounts).filter(count => count >= 3).length;
        const totalUsers = analyticsData.users.size;
        const powerUserPercentage = totalUsers > 0 ? (powerUsers / totalUsers * 100).toFixed(1) : 0;

        const avgQuestionsPerUser = totalUsers > 0 ? 
          (analyticsData.questions.length / totalUsers).toFixed(1) : 0;

        const insights = {
          powerUserPercentage,
          returnRate: '0', // Would need session tracking to calculate
          avgQuestionsPerUser,
          rateLimitHitters: analyticsData.rateLimitHits,
          conversionReadiness: {
            highEngagement: powerUsers,
            rateLimitHit: analyticsData.rateLimitHits
          }
        };

        console.log('Returning freemium insights:', insights);
        return res.status(200).json(insights);
      }

      return res.status(400).json({ error: 'Invalid action parameter' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Analytics API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}