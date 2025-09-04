// Simple in-memory analytics (for production, use a database)
let analytics = {
  dailyUsers: new Set(),
  questions: [],
  feedback: [],
  dailyLimits: new Map()
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, fingerprint, ...data } = req.body;

  switch (action) {
    case 'check_limit':
      const today = new Date().toDateString();
      const key = `${fingerprint}-${today}`;
      const used = analytics.dailyLimits.get(key) || 0;
      const remaining = Math.max(0, 3 - used);
      
      res.status(200).json({ remaining });
      break;

    case 'question_asked':
      analytics.dailyUsers.add(fingerprint);
      analytics.questions.push({
        timestamp: new Date(),
        topic: data.topic,
        fingerprint,
        questionLength: data.questionLength
      });
      
      // Update daily limit
      const todayKey = `${fingerprint}-${new Date().toDateString()}`;
      const currentUsed = analytics.dailyLimits.get(todayKey) || 0;
      analytics.dailyLimits.set(todayKey, currentUsed + 1);
      
      res.status(200).json({ success: true });
      break;

    case 'feedback':
      analytics.feedback.push({
        timestamp: new Date(),
        helpful: data.helpful,
        fingerprint
      });
      
      res.status(200).json({ success: true });
      break;

    case 'get_stats':
      // Admin endpoint to view stats
      const stats = {
        totalUsers: analytics.dailyUsers.size,
        totalQuestions: analytics.questions.length,
        totalFeedback: analytics.feedback.length,
        topicBreakdown: {}
      };
      
      analytics.questions.forEach(q => {
        stats.topicBreakdown[q.topic] = (stats.topicBreakdown[q.topic] || 0) + 1;
      });
      
      res.status(200).json(stats);
      break;

    default:
      res.status(400).json({ error: 'Invalid action' });
  }
}
