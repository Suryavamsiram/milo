// Milo's conversational state machine - no external AI API needed
// Uses structured NLP parsing to extract gig parameters from natural language

export type GigCategory =
  | 'Garage & Vehicle Maintenance'
  | 'Furniture Assembly & Moving'
  | 'Tutoring & Academic Help'
  | 'Tech Support & Repairs'
  | 'Laundry & Errands'
  | 'Cleaning & Organization'
  | 'Photography & Videography'
  | 'Graphic Design & Creative Work'
  | 'Event Help & Setup'
  | 'Food & Grocery Runs'
  | 'Pet Care'
  | 'Other';

export type ConversationPhase =
  | 'greeting'
  | 'mode_select'
  | 'collect_category'
  | 'collect_description'
  | 'collect_location'
  | 'collect_pay'
  | 'confirm'
  | 'submitted'
  | 'browsing_matches';

export type GigMode = 'post' | 'search' | null;

export type ExtractedGigData = {
  mode: GigMode;
  category: GigCategory | null;
  title: string;
  description: string;
  campus_location: string;
  is_remote: boolean;
  pay_min: number | null;
  pay_max: number | null;
};

const CATEGORY_KEYWORDS: Record<GigCategory, string[]> = {
  'Garage & Vehicle Maintenance': ['car', 'vehicle', 'garage', 'oil', 'tire', 'battery', 'mechanic', 'auto'],
  'Furniture Assembly & Moving': ['furniture', 'couch', 'sofa', 'desk', 'move', 'moving', 'assemble', 'ikea', 'bed', 'chair', 'table', 'carry'],
  'Tutoring & Academic Help': ['tutor', 'tutoring', 'study', 'homework', 'math', 'calculus', 'physics', 'chemistry', 'essay', 'writing', 'sat', 'act', 'ap ', 'academic', 'exam', 'test prep'],
  'Tech Support & Repairs': ['tech', 'computer', 'laptop', 'phone', 'wifi', 'internet', 'code', 'coding', 'software', 'hardware', 'fix', 'repair', 'setup', 'install'],
  'Laundry & Errands': ['laundry', 'errand', 'pickup', 'drop off', 'wash', 'dry cleaning', 'post office', 'mail'],
  'Cleaning & Organization': ['clean', 'cleaning', 'organize', 'organization', 'tidy', 'declutter', 'dorm', 'room'],
  'Photography & Videography': ['photo', 'photograph', 'video', 'film', 'camera', 'headshot', 'portrait', 'shoot', 'edit', 'editing'],
  'Graphic Design & Creative Work': ['design', 'graphic', 'logo', 'flyer', 'poster', 'illustration', 'creative', 'art', 'photoshop', 'figma'],
  'Event Help & Setup': ['event', 'party', 'setup', 'catering', 'serve', 'help at', 'volunteer', 'staff'],
  'Food & Grocery Runs': ['grocery', 'food', 'delivery', 'instacart', 'restaurant', 'meal', 'snack', 'cook', 'cooking'],
  'Pet Care': ['pet', 'dog', 'cat', 'walk', 'walker', 'sit', 'sitter', 'animal', 'feed'],
  Other: [],
};

export function detectCategory(text: string): GigCategory {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [GigCategory, string[]][]) {
    if (category === 'Other') continue;
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'Other';
}

export function detectMode(text: string): GigMode {
  const lower = text.toLowerCase();
  const postWords = ['post', 'need someone', 'hire', 'find someone', 'get help', 'i need someone', 'looking for someone'];
  const searchWords = ['find a gig', 'search', 'looking for a gig', 'earn', 'work', 'job', 'make money', 'help someone', 'offer', 'undertake', 'i want to work', 'find work', 'want a gig', 'looking for work', 'gig for me'];

  // Check for explicit worker/finder intent first
  const workerPhrases = ['i want to work', 'find work', 'looking for work', 'find a gig', 'looking for a gig', 'want a job', 'need a gig', 'gig for me', 'i want a gig'];
  if (workerPhrases.some((p) => lower.includes(p))) return 'search';

  // Check for explicit poster/hirer intent
  const posterPhrases = ['i need someone', 'need help with', 'hire someone', 'post a gig', 'find someone to'];
  if (posterPhrases.some((p) => lower.includes(p))) return 'post';

  const postScore = postWords.filter((w) => lower.includes(w)).length;
  const searchScore = searchWords.filter((w) => lower.includes(w)).length;

  if (postScore > searchScore) return 'post';
  if (searchScore > postScore) return 'search';
  return null;
}

export function extractPayRange(text: string): { min: number | null; max: number | null } {
  // Patterns: "$20-$40", "$20 to $40", "20-40", "around $30", "$25/hr"
  const rangeMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*\$?(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }

  const singleMatch = text.match(/(?:around|about|~)?\s*\$(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    return { min: Math.max(val - 5, 0), max: val + 5 };
  }

  return { min: null, max: null };
}

export function extractLocation(text: string): string {
  // Common campus location patterns
  const patterns = [
    /(?:near|at|in|by)\s+([A-Z][a-zA-Z\s]+(?:Hall|Building|Quad|Center|Library|Dorm|Plaza|Ave|Street|Rd))/i,
    /([A-Z][a-zA-Z\s]+(?:Hall|Building|Quad|Center|Library|Dorm))/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  if (text.toLowerCase().includes('remote') || text.toLowerCase().includes('online')) return 'Remote';
  return '';
}

export function getMiloGreeting(): string {
  return "Hey! I'm **Milo**, your campus gig concierge. Are you looking to **post a gig** (need help with something) or **find a gig** (earn money helping others)?";
}

export function getMiloResponse(phase: ConversationPhase, data: ExtractedGigData, userMessage: string): string {
  switch (phase) {
    case 'collect_category': {
      const cat = data.category || detectCategory(userMessage);
      if (cat && cat !== 'Other') {
        return `Got it — I'd categorize that as **${cat}**. Where on campus does this need to happen, and roughly what's your budget?`;
      }
      return `Interesting! Can you describe what kind of help you need a bit more? For example: moving furniture, tutoring, tech support, pet care...`;
    }
    case 'collect_location':
      return `Where on campus, and what's the pay range you have in mind?`;
    case 'collect_pay':
      return `What's the budget for this? For example, "$20–$40" or "around $30/hr".`;
    case 'confirm': {
      const loc = data.is_remote ? 'Remote / Online' : (data.campus_location || 'Campus');
      const pay = data.pay_min !== null && data.pay_max !== null
        ? `$${data.pay_min}–$${data.pay_max}`
        : 'Flexible';
      return `Here's what I'll ${data.mode === 'post' ? 'post for you' : 'search for'}:\n\n**${data.title || data.category}**\n- Category: ${data.category}\n- Location: ${loc}\n- Pay: ${pay}\n- Description: ${data.description}\n\nDoes this look right? Say **"yes"** to ${data.mode === 'post' ? 'post it' : 'find matching gigs'}, or let me know what to change.`;
    }
    case 'submitted':
      return data.mode === 'post'
        ? `Your gig is live! I'm now routing it to the best-matched candidates. Sit tight...`
        : `On it! Scanning the marketplace for matches...`;
    default:
      return `Got it! Let me help you with that.`;
  }
}
