import { OpenAI } from 'openai';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { checkRateLimit } from '../../utils/rateLimit';
import { detectBot } from '../../utils/botDetection';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load and decompress stories
let stories;
try {
  const compressedPath = path.join(process.cwd(), 'data', 'stories-with-embeddings.json.gz');
  const compressedData = fs.readFileSync(compressedPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  stories = JSON.parse(decompressedData.toString());
  console.log(`Loaded ${stories.length} stories with embeddings from compressed file`);
} catch (error) {
  console.error('Error loading compressed stories:', error);
  // Fallback to regular stories if compressed file fails
  const fallbackStories = await import('../../data/stories.json');
  stories = fallbackStories.default;
  console.log(`Fallback: Loaded ${stories.length} stories without embeddings`);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Practice suggestions by topic
const practicesByTopic = {
  work: [
    "Take three deep breaths and repeat softly: 'I am provided for.'",
    "Offer your next small task as seva, not as burden.",
    "Pause for a minute, close your eyes, and say 'Ram Ram' before resuming work."
  ],
  relationships: [
    "Light a small diya for your loved ones and silently send them blessings.",
    "Place your hand on your heart and repeat 'Sab Ram hai'.",
    "Write down one thing you appreciate about a family member today."
  ],
  health: [
    "Sit quietly for 2 minutes and repeat 'I am healing, I am whole.'",
    "Take a mindful walk — each step repeating 'Ram Ram'.",
    "Offer gratitude to your body for carrying you this far."
  ],
  grief: [
    "Hold a photo or memory of your loved one and softly chant 'Ram Ram'.",
    "Write one line of love and release it into the air.",
    "Sit quietly and imagine Maharaj-ji's blanket of love around you."
  ],
  faith: [
    "Chant the Hanuman Chalisa (even one verse) with devotion.",
    "Sit for 5 minutes and repeat 'Ram Ram' without distraction.",
    "Offer a flower, mentally or physically, at Maharaj-ji's feet."
  ],
  other: [
    "Sit in silence for one minute, breathing in 'Ra', breathing out 'M'.",
    "Offer whatever is in your heart as prayer — no words needed.",
    "Fold your hands, bow your head, and whisper 'Thank you Maharaj-ji.'"
  ]
};

// Empathy responses
const empathyResponses = [
  "I'm sorry you're going through this. Let's look at what the sources say and find some guidance.",
  "It sounds like you're facing a difficult time. Here are some stories from fellow devotees who've walked similar paths.",
  "Your heart is heavy right now. Let these stories remind you that you're not alone in this journey.",
  "I understand this feels overwhelming. Here's what other devotees have shared about similar experiences.",
  "This must be challenging for you. Let's see what wisdom these stories might offer."
];

// Reflection questions by topic
const reflectionQuestions = {
  work: [
    "What would it feel like to trust that Ram is guiding your career path?",
    "How might this work situation be preparing you for something greater?",
    "What aspects of seva (service) can you find in your current circumstances?"
  ],
  relationships: [
    "How can you see the divine in the people who challenge you most?",
    "What would unconditional love look like in this situation?",
    "How might forgiveness free your own heart, regardless of others' actions?"
  ],
  health: [
    "What is your body teaching you about surrender and acceptance?",
    "How can you honor both healing and acceptance in this moment?",
    "What would it mean to trust completely in divine timing for your recovery?"
  ],
  grief: [
    "How do you feel your loved one's presence in your daily life now?",
    "What beautiful memories bring you closest to feeling their continued love?",
    "How might your grief be a testament to the depth of your connection?"
  ],
  faith: [
    "Where do you feel Maharaj-ji's presence most clearly in your life?",
    "What simple practice makes your heart feel most connected to the divine?",
    "How has your spiritual journey surprised you so far?"
  ],
  other: [
    "What would change if you fully trusted that you are deeply loved?",
    "How might this challenge be an invitation to grow in unexpected ways?",
    "What does your heart most need to hear right now?"
  ]
};

// Gentle next steps by topic
const gentleNextSteps = {
  work: [
    "When you're ready, consider how this change might be Ram's way of opening a new door",
    "You might find peace in dedicating your job search as an offering to Maharaj-ji",
    "Consider reaching out to someone in your network - sometimes help comes through unexpected connections"
  ],
  relationships: [
    "When it feels right, you might try sending loving thoughts to those who've hurt you",
    "Consider having that difficult conversation you've been avoiding, with love as your guide",
    "You might find healing in serving others who are also struggling with relationships"
  ],
  health: [
    "Consider offering your healing journey as service to others facing similar challenges",
    "When you're ready, you might explore how this experience is deepening your compassion",
    "You might find comfort in dedicating your recovery process to Maharaj-ji"
  ],
  grief: [
    "When it feels right, you might honor your loved one through acts of kindness",
    "Consider sharing a favorite memory with someone who also loved them",
    "You might find peace in doing something your loved one enjoyed, as a way of feeling close to them"
  ],
  faith: [
    "When you feel called, consider deepening one spiritual practice that brings you joy",
    "You might find meaning in sharing your spiritual experiences with other seekers",
    "Consider visiting a place that makes you feel connected to the divine"
  ],
  other: [
    "When you feel ready, consider how this experience might help you serve others",
    "You might find peace in dedicating this challenge to Maharaj-ji's guidance",
    "Consider reaching out to someone who cares about you and sharing what's in your heart"
  ]
};

// Gratitude prompts
const gratitudePrompts = [
  "Take a moment to feel Maharaj-ji's love surrounding you right now",
  "Notice the breath moving in and out - a gift you don't have to earn",
  "Feel gratitude for having a heart open enough to seek guidance",
  "Rest in the knowing that you are held by an infinite love",
  "Thank Maharaj-ji for bringing you exactly what you need, when you need it"
];

function getRandomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCommunityElement(storyCount) {
  const messages = [
    `You're among ${Math.floor(Math.random() * 200) + 100}+ devotees who have found comfort in these stories`,
    `Hundreds of devotees have walked this path before you - you are not alone`,
    `This community of seekers understands your journey intimately`,
    `You join countless others who have found hope in these shared experiences`
  ];
  return getRandomFromArray(messages);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Bot detection
    if (detectBot(req)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { question, topic, fingerprint } = req.body;

    if (!question || !topic || !fingerprint) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(fingerprint, req.ip);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({ 
        error: 'rate_limit',
        remaining: 0 
      });
    }

    // Clean question (remove salutations)
    const cleanedQuestion = question
      .replace(/^(ram\s+ram|ram|baba|maharaj-?ji|maharaj)\s*/gi, '')
      .trim();

    // Create embedding for the question
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: `${cleanedQuestion} ${topic}`,
    });

    const questionEmbedding = embedding.data[0].embedding;

    // Calculate similarity using embeddings
    const scoredStories = stories.map(story => {
      if (!story.embedding) {
        console.warn(`Story ${story.id} missing embedding, skipping`);
        return { ...story, similarity: 0 };
      }
      
      const similarity = cosineSimilarity(questionEmbedding, story.embedding);
      
      return {
        ...story,
        similarity: similarity
      };
    });

    // Filter by similarity threshold and sort
    const SIMILARITY_THRESHOLD = 0.50;
    const relevantStories = scoredStories
      .filter(story => story.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    // Enhanced debugging
    console.log('=== EMBEDDING SIMILARITY DEBUG ===');
    console.log(`Query: "${cleanedQuestion}" (Topic: ${topic})`);
    console.log('Top 10 similarity scores:');
    scoredStories
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .forEach((story, i) => {
        console.log(`${i+1}. "${story.title}" - Score: ${story.similarity.toFixed(3)}`);
      });
    console.log('===============================');

    // If no relevant stories found, return fallback
    if (relevantStories.length === 0) {
      const bestScore = scoredStories.sort((a, b) => b.similarity - a.similarity)[0]?.similarity || 0;
      console.log(`No stories above ${SIMILARITY_THRESHOLD} threshold. Best score: ${bestScore.toFixed(3)}`);
      
      return res.status(200).json({
        fallback: true,
        message: "Sorry, we don't have any stories matching your situation right now. Try sharing a few words (like 'job loss', 'illness', 'faith').",
        remaining: rateLimitResult.remaining
      });
    }

    // Generate full response structure
    const response = {
      empathy: getRandomFromArray(empathyResponses),
      stories: relevantStories.map(story => ({
        ...story,
        source_url: story.source_url || "Miracle of Love, Ram Dass"
      })),
      reflection: getRandomFromArray(reflectionQuestions[topic] || reflectionQuestions.other),
      community: generateCommunityElement(relevantStories.length),
      practice: getRandomFromArray(practicesByTopic[topic] || practicesByTopic.other),
      nextSteps: getRandomFromArray(gentleNextSteps[topic] || gentleNextSteps.other),
      gratitude: getRandomFromArray(gratitudePrompts),
      remaining: rateLimitResult.remaining
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
// Updated for embedding similarity