import { useState, useEffect } from 'react';
import { generateFingerprint } from '../utils/fingerprint';
import { checkRateLimit } from '../utils/rateLimit';

export default function QnABot() {
  const [question, setQuestion] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [remainingQuestions, setRemainingQuestions] = useState(3);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [humanVerified, setHumanVerified] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const topics = [
    'Work/Finances',
    'Relationships/Family',
    'Health/Body',
    'Grief/Loss',
    'Faith/Practice',
    'Other'
  ];

  const dailyQuote = {
    text: "Love everyone, serve everyone, remember God.",
    attribution: "Neem Karoli Baba"
  };

  useEffect(() => {
    checkDailyLimit();
  }, []);

  const checkDailyLimit = async () => {
    const fingerprint = generateFingerprint();
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'check_limit',
        fingerprint 
      })
    });
    
    const data = await response.json();
    setRemainingQuestions(data.remaining);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!question.trim() || !selectedTopic) return;
    
    if (remainingQuestions <= 0) {
      alert('You have reached your daily limit of 3 questions. Please return tomorrow for more guidance.');
      return;
    }

    if (!humanVerified) {
      setShowCaptcha(true);
      return;
    }

    // Truncate to 25 words
    const words = question.trim().split(' ');
    const truncatedQuestion = words.slice(0, 25).join(' ');

    setLoading(true);
    setStories([]);

    try {
      const fingerprint = generateFingerprint();
      
      const response = await fetch('/api/search-stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: truncatedQuestion,
          topic: selectedTopic,
          fingerprint
        })
      });

      const data = await response.json();
      
      if (data.error) {
        if (data.error === 'rate_limit') {
          alert('You have reached your daily limit. Please try again tomorrow.');
          return;
        }
        throw new Error(data.error);
      }

      setStories(data.stories || []);
      setRemainingQuestions(data.remaining);
      
      // Track analytics
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question_asked',
          topic: selectedTopic,
          fingerprint,
          questionLength: truncatedQuestion.split(' ').length
        })
      });

    } catch (error) {
      console.error('Search error:', error);
      alert('Sorry, there was an error processing your question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaVerify = async () => {
    // Simple bot detection
    const response = await fetch('/api/verify-human', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: generateFingerprint(),
        timestamp: Date.now()
      })
    });

    const data = await response.json();
    if (data.verified) {
      setHumanVerified(true);
      setShowCaptcha(false);
      handleSubmit(new Event('submit'));
    }
  };

  const loadMoreStories = async () => {
    // Implementation for loading more stories
    console.log('Load more stories functionality');
  };

  const submitFeedback = async (helpful) => {
    setFeedback(helpful);
    
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'feedback',
        helpful: helpful,
        fingerprint: generateFingerprint()
      })
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Daily Darshan Widget */}
      <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6 rounded-r-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">🙏</span>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-orange-800">Daily Darshan</h3>
            <p className="italic text-orange-700 mt-1">"{dailyQuote.text}"</p>
            <p className="text-sm text-orange-600 mt-1">- {dailyQuote.attribution}</p>
          </div>
        </div>
      </div>

      {/* Meditation Video Section */}
      <div className="mb-6 text-center">
        <button
          onClick={() => setShowVideoModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          🧘‍♀️ Guided Ram Ram Meditation
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Question Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What's in your heart
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Share what's troubling you..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">
                {question.split(' ').length}/25 words (auto-truncated)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic (helps us find relevant stories)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {topics.map(topic => (
                  <label key={topic} className="flex items-center">
                    <input
                      type="radio"
                      name="topic"
                      value={topic}
                      checked={selectedTopic === topic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm">{topic}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Questions remaining today: {remainingQuestions}
              </span>
              <button
                type="submit"
                disabled={!question.trim() || !selectedTopic || loading}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Searching...' : 'Ask'}
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">🙏 Maharajji is listening...</p>
            </div>
          )}

          {stories.length > 0 && (
            <div className="space-y-6">
              <p className="text-gray-700 italic">
                I feel your concern. Let me share what might help from the stories.
              </p>

              <div>
                <h3 className="font-semibold text-gray-800 mb-3">What the sources say</h3>
                {stories.map((story, index) => (
                  <div key={story.id} className="mb-4 p-4 border-l-4 border-red-200 bg-gray-50">
                    <h4 className="font-medium text-gray-800">
                      Story {index + 1}: {story.title}
                    </h4>
                    <p className="text-gray-700 mt-2">
                      {story.content.substring(0, 150)}...
                    </p>
                    <details className="mt-2">
                      <summary className="text-red-600 cursor-pointer hover:text-red-800">
                        Read more
                      </summary>
                      <div className="mt-3 space-y-2">
                        <p className="text-gray-700">{story.content}</p>
                        <p className="text-sm text-gray-600">
                          <strong>Source:</strong> {story.source_url}
                        </p>
                      </div>
                    </details>
                  </div>
                ))}
              </div>

              {/* Commentary */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Reflection</h3>
                <p className="text-gray-700">
                  These stories remind us that Maharajji's grace works in mysterious ways. 
                  Trust in divine timing and know that you are held in love.
                </p>
              </div>

              {/* Practice */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Practice for Today</h3>
                <p className="text-gray-700 italic">
                  Take a quiet breath, repeat 'Ram Ram' a few times, and know you are not alone.
                </p>
              </div>

              {/* Feedback */}
              {feedback === null && (
                <div className="border-t pt-4">
                  <p className="text-gray-700 mb-3">🙏 Did this answer help you?</p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => submitFeedback(true)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                    >
                      👍 Yes
                    </button>
                    <button
                      onClick={() => submitFeedback(false)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                    >
                      👎 No
                    </button>
                  </div>
                </div>
              )}

              {feedback !== null && (
                <div className="border-t pt-4">
                  <p className="text-gray-700">
                    {feedback ? "🙏 Thank you for your feedback!" : "Thank you. We'll work to improve."}
                  </p>
                </div>
              )}
            </div>
          )}

          {stories.length === 0 && !loading && question && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                🙏 Sorry, we don't have any stories matching your situation right now. 
                Try sharing a few words (like 'job loss', 'illness', 'faith').
              </p>
              <button
                onClick={() => {
                  setQuestion('');
                  setSelectedTopic('');
                  setStories([]);
                }}
                className="text-orange-600 hover:text-orange-800 underline"
              >
                Ask differently
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CAPTCHA Modal */}
      {showCaptcha && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">Human Verification</h3>
            <p className="text-gray-600 mb-4">Please verify you're not a robot</p>
            <div className="flex gap-4">
              <button
                onClick={handleCaptchaVerify}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                ✓ I'm Human
              </button>
              <button
                onClick={() => setShowCaptcha(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-2xl mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Ram Ram Meditation</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <video controls className="w-full rounded">
              <source src="/Ram-Ram-meditation.mp4" type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>
        </div>
      )}
    </div>
  );
}
