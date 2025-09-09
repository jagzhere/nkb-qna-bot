// pages/api/analytics.js - Launch-ready version

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log(`Analytics ${req.method} request:`, req.query, req.body);

  try {
    if (req.method === 'POST') {
      const { action, fingerprint, timestamp = new Date().toISOString(), ...data } = req.body;
      
      console.log('Analytics POST:', { action, fingerprint });

      // Track everything without filtering
      analyticsData.users.add(fingerprint);
      
      if (action === 'question_asked') {
        analyticsData.questions.push({
          timestamp,
          fingerprint,
          topic: data.topic,
          questionText: data.questionText || 'Question text not captured',
          language: data.language || 'english',
          hasResults: data.hasResults !== false,
          similarityScore: data.similarityScore
        });
        console.log('Question tracked. Total questions:', analyticsData.questions.length);
      }

      if (action === 'page_view') {
        analyticsData.pageViews.push({
          timestamp,
          fingerprint,
          page: data.page || '/',
          language: data.language || 'english'
        });
      }

      if (action === 'rate_limit_hit') {
        analyticsData.rateLimitHits++;
      }

      if (action === 'feature_usage') {
        const featureName = data.feature;
        if (!analyticsData.features[featureName]) {
          analyticsData.features[featureName] = { count: 0, users: new Set() };
        }
        analyticsData.features[featureName].count++;
        analyticsData.features[featureName].users.add(fingerprint);
      }

      return res.status(200).json({ success: true, tracked: action });

    } else if (req.method === 'GET') {
      const totalUsers = analyticsData.users.size;
      const totalQuestions = analyticsData.questions.length;
      
      console.log('Analytics GET - returning stats:', { totalUsers, totalQuestions });
      
      const topicBreakdown = {};
      analyticsData.questions.forEach(q => {
        topicBreakdown[q.topic] = (topicBreakdown[q.topic] || 0) + 1;
      });

      const languagePreference = { english: 0, hindi: 0 };
      analyticsData.questions.forEach(q => {
        languagePreference[q.language]++;
      });

      const stats = {
        totalUsers,
        totalQuestions,
        totalSessions: Math.max(analyticsData.sessions.length, totalUsers),
        rateLimitHits: analyticsData.rateLimitHits,
        pageViews: { 
          homepage: analyticsData.pageViews.length,
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

      return res.status(200).json(stats);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: 'Analytics error', 
      details: error.message 
    });
  }
}
