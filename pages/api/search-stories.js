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

// Translation helper
async function translateText(text, targetLanguage) {
  if (targetLanguage === 'english') return text;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a translator specializing in spiritual and devotional content. Translate the given text to Hindi while preserving the spiritual essence and emotional tone. Keep any references to 'Ram', 'Maharaj-ji', 'Neem Karoli Baba' in their original forms."
        },
        {
          role: "user",
          content: `Translate to Hindi: ${text}`
        }
      ],
      temperature: 0.3,
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text
  }
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

// Topic-specific keyword suggestions for fallback
const keywordSuggestions = {
  work: ["job loss", "career change", "money stress", "work pressure", "unemployment"],
  relationships: ["family conflict", "marriage problems", "daughter", "son", "parent issues"],
  health: ["illness", "pain", "healing", "medical worry", "body weakness"],
  grief: ["death", "loss", "mourning", "missing someone", "goodbye"],
  faith: ["doubt", "prayer", "spiritual dryness", "questioning beliefs", "connection"],
  other: ["life direction", "purpose", "confusion", "seeking guidance", "lost"]
};

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

// Generate dynamic empathy based on question content
async function generateDynamicEmpathy(question, topic, language) {
  try {
    const prompt = `Generate a single, compassionate empathy line (max 20 words) for someone asking: "${question}" (topic: ${topic}). Be warm and acknowledge their specific situation. Don't use generic phrases.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a compassionate spiritual counselor. Generate brief, specific empathy responses that acknowledge the person's exact situation."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 50
    });
    
    let empathy = response.choices[0].message.content.trim().replace(/['"]/g, '');
    
    // Translate if needed
    if (language === 'hindi') {
      empathy = await translateText(empathy, 'hindi');
    }
    
    return empathy;
  } catch (error) {
    console.error('Error generating empathy:', error);
    // Fallback empathy responses
    const fallbacks = [
      "I understand you're going through a difficult time.",
      "Your heart is heavy right now, and that's completely understandable.",
      "This sounds really challenging for you."
    ];
    return getRandomFromArray(fallbacks);
  }
}

// Generate combined lessons from stories
async function generateCombinedLessons(stories, question, topic, language) {
  try {
    const storyLessons = stories.map(story => story.lessons || []).flat();
    const lessonsText = storyLessons.join('. ');
    
    const prompt = `Based on these story lessons: "${lessonsText}"
    
    Generate 2-3 specific takeaways for someone asking: "${question}" (topic: ${topic})
    
    Format as an array of strings. Each takeaway should:
    - Connect the story lessons to their specific situation
    - Be practical and actionable
    - Feel personal and relevant
    - Be 15-25 words each
    
    Example format: ["First specific takeaway...", "Second relevant point...", "Third practical insight..."]`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a wise spiritual counselor. Create personalized, practical lessons that connect ancient wisdom to modern problems."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 150
    });
    
    let lessonsText = response.choices[0].message.content.trim();
    
    // Try to parse as JSON array, fallback to text processing
    let lessons;
    try {
      lessons = JSON.parse(lessonsText);
    } catch {
      // Fallback: split by quotes and filter
      lessons = lessonsText.split('"').filter(l => l.length > 20 && !l.includes('[') && !l.includes(']'));
    }
    
    // Ensure we have 2-3 lessons
    if (!Array.isArray(lessons) || lessons.length === 0) {
      lessons = [
        "These stories suggest that divine guidance often comes in unexpected ways",
        "Trust that your current challenges are preparing you for something meaningful",
        "Remember that countless devotees have found strength in similar circumstances"
      ];
    }
    
    lessons = lessons.slice(0, 3); // Limit to 3 lessons
    
    // Translate if needed
    if (language === 'hindi') {
      const translatedLessons = await Promise.all(
        lessons.map(lesson => translateText(lesson, 'hindi'))
      );
      return translatedLessons;
    }
    
    return lessons;
    
  } catch (error) {
    console.error('Error generating combined lessons:', error);
    // Fallback lessons
    return [
      "These stories remind us that challenges often lead to unexpected growth",
      "Divine guidance frequently appears when we least expect it",
      "Your current struggle is preparing you for greater understanding"
    ];
  }
}

// Generate relevance preview for top story
async function generateRelevancePreview(story, question, language) {
  try {
    const prompt = `Why is this story relevant to someone asking "${question}"? Generate a one-line relevance preview (10-15 words) starting with "This story speaks to" or "This story shows how"`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system", 
          content: "Generate brief relevance previews that help devotees understand why a story was chosen for their question."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 30
    });
    
    let relevance = response.choices[0].message.content.trim();
    
    // Translate if needed
    if (language === 'hindi') {
      relevance = await translateText(relevance, 'hindi');
    }
    
    return relevance;
  } catch (error) {
    console.error('Error generating relevance:', error);
    return null; // Don't show relevance if generation fails
  }
}

// Generate smart keyword suggestions based on actual story content
function generateSmartKeywords(topic, stories) {
  // Extract keywords from stories with good content in this topic
  const topicStories = stories.filter(story => {
    const content = (story.life_situations || []).concat(story.emotions || []).concat(story.themes || []);
    return content.some(item => item.toLowerCase().includes(topic.toLowerCase()));
  });
  
  // If we have topic-specific stories, extract their keywords
  if (topicStories.length > 0) {
    const allKeywords = topicStories
      .flatMap(story => (story.life_situations || []).concat(story.emotions || []))
      .filter(keyword => keyword.length > 3)
      .slice(0, 5);
    
    if (allKeywords.length > 0) {
      return allKeywords;
    }
  }
  
  // Fallback to predefined keywords
  return keywordSuggestions[topic] || keywordSuggestions.other;
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

    const { question, topic, fingerprint, language = 'english' } = req.body;

    if (!question || !topic || !fingerprint) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(fingerprint, req.ip);
    if (!rateLimitResult.allowed) {
      const limitMessage = language === 'hindi' ? 
        'आपने 3 प्रश्नों की दैनिक सीमा पूरी कर ली है। कृपया कल फिर कोशिश करें।' :
        'You\'ve reached your daily limit of 3 questions. Please try again tomorrow.';
      return res.status(429).json({ 
        error: 'rate_limit',
        message: limitMessage,
        remaining: 0 
      });
    }

    // Clean question (remove salutations)
    const cleanedQuestion = question
      .replace(/^(ram\s+ram|ram|baba|maharaj-?ji|maharaj)\s*/gi, '')
      .trim();

    // For Hindi questions, translate to English for processing
    let questionForProcessing = cleanedQuestion;
    if (language === 'hindi') {
      try {
        const translationResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Translate the following Hindi text to English, preserving the meaning and context."
            },
            {
              role: "user",
              content: cleanedQuestion
            }
          ],
          temperature: 0.3,
        });
        questionForProcessing = translationResponse.choices[0].message.content.trim();
      } catch (error) {
        console.error('Translation error for question:', error);
        // Continue with original question if translation fails
      }
    }

    // Create embedding for the question
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: `${questionForProcessing} ${topic}`,
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
    const SIMILARITY_THRESHOLD = 0.30;
    const relevantStories = scoredStories
      .filter(story => story.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    // Enhanced debugging
    console.log('=== EMBEDDING SIMILARITY DEBUG ===');
    console.log(`Query: "${cleanedQuestion}" (Topic: ${topic}, Language: ${language})`);
    console.log('Top 10 similarity scores:');
    scoredStories
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .forEach((story, i) => {
        console.log(`${i+1}. "${story.title}" - Score: ${story.similarity.toFixed(3)}`);
      });
    console.log('===============================');

    // If no relevant stories found, return smart fallback
    if (relevantStories.length === 0) {
      const bestScore = scoredStories.sort((a, b) => b.similarity - a.similarity)[0]?.similarity || 0;
      console.log(`No stories above ${SIMILARITY_THRESHOLD} threshold. Best score: ${bestScore.toFixed(3)}`);
      
      const smartKeywords = generateSmartKeywords(topic, stories);
      const keywordList = smartKeywords.slice(0, 4).map(k => `'${k}'`).join(', ');
      
      let fallbackMessage = `Sorry, we don't have any stories matching your situation right now. Try keywords like: ${keywordList}`;
      
      // Translate fallback message if needed
      if (language === 'hindi') {
        fallbackMessage = await translateText(fallbackMessage, 'hindi');
      }
      
      return res.status(200).json({
        fallback: true,
        message: fallbackMessage,
        remaining: rateLimitResult.remaining
      });
    }

    // Generate dynamic empathy
    const empathy = await generateDynamicEmpathy(cleanedQuestion, topic, language);

    // Generate combined lessons
    const lessons = await generateCombinedLessons(relevantStories, cleanedQuestion, topic, language);

    // Generate relevance preview for top story only
    const topStory = relevantStories[0];
    const relevancePreview = await generateRelevancePreview(topStory, cleanedQuestion, language);

    // Prepare stories with relevance preview for top story
    const storiesWithRelevance = relevantStories.map((story, index) => ({
      ...story,
      source_url: story.source_url || "Miracle of Love, Ram Dass",
      relevance: index === 0 ? relevancePreview : null // Only top story gets relevance
    }));

    // Generate other response elements
    let reflection = getRandomFromArray(reflectionQuestions[topic] || reflectionQuestions.other);
    let community = generateCommunityElement(relevantStories.length);
    let practice = getRandomFromArray(practicesByTopic[topic] || practicesByTopic.other);
    let nextSteps = getRandomFromArray(gentleNextSteps[topic] || gentleNextSteps.other);
    let gratitude = getRandomFromArray(gratitudePrompts);

    // Translate response elements if needed
    if (language === 'hindi') {
      [reflection, community, practice, nextSteps, gratitude] = await Promise.all([
        translateText(reflection, 'hindi'),
        translateText(community, 'hindi'),
        translateText(practice, 'hindi'),
        translateText(nextSteps, 'hindi'),
        translateText(gratitude, 'hindi')
      ]);

      // Translate story titles and content
      for (let story of storiesWithRelevance) {
        story.title = await translateText(story.title, 'hindi');
        story.content = await translateText(story.content, 'hindi');
      }
    }

    // Generate full response structure
    const response = {
      empathy,
      stories: storiesWithRelevance,
      lessons, // New combined lessons section
      reflection,
      community,
      practice,
      nextSteps,
      gratitude,
      remaining: rateLimitResult.remaining
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
