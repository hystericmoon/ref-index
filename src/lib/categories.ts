// Showcase categories: what kind of site it is, and what field it's in. A site can have
// several. scripts/categorize-showcase.ts assigns them from each site's own title, description
// and headings (plus the galleries' tags); editors can correct them later.

export type Category = { id: string; label: string; group: "type" | "industry"; words: RegExp };

export const CATEGORIES: Category[] = [
  // What kind of site
  { id: "portfolio", label: "Portfolio", group: "type", words: /\b(portfolio|personal (site|website|page)|(product|ux|ui|graphic|visual|web|digital|interaction) designer|selected (work|projects)|my work|freelance|designer and developer|art director|photographer|illustrator|creative developer|motion designer)\b/i },
  { id: "agency", label: "Agency & studio", group: "type", words: /\b(agency|studio|creative studio|design studio|branding studio|digital studio|we are a|consultancy)\b/i },
  { id: "product", label: "SaaS & product", group: "type", words: /\b(saas|platform|software|free trial|start for free|get started|sign up|book a demo|request a demo|workflow|dashboard|integrations?|for teams)\b/i },
  { id: "shop", label: "E-commerce", group: "type", words: /\b(shop|store|add to cart|free shipping|buy now|shop now|online store|e-?commerce|new arrivals)\b/i },
  { id: "editorial", label: "Editorial & blog", group: "type", words: /\b(magazine|journal|blog|editorial|publication|podcast|news|articles)\b/i },
  { id: "event", label: "Events", group: "type", words: /\b(conference|festival|summit|tickets|exhibition|meetup|awards? (night|ceremony)|register now|expo)\b/i },
  // What field it's in
  { id: "ai", label: "AI", group: "industry", words: /\b(ai|a\.i\.|artificial intelligence|machine learning|llms?|gpt|ai agents?|generative)\b/i },
  { id: "finance", label: "Finance", group: "industry", words: /\b(fintech|bank(ing)?|payments?|invest(ing|ment)?|finance|financial|money|credit card|accounting|insurance)\b/i },
  { id: "web3", label: "Crypto & web3", group: "industry", words: /\b(crypto(currency)?|blockchain|web3|nfts?|defi|ethereum|bitcoin|solana|wallet)\b/i },
  { id: "dev", label: "Developer tools", group: "industry", words: /\b(for developers|developer (platform|tools|experience)|api|sdk|open[- ]source|devops|deploy(ment)?|database|infrastructure|code editor)\b/i },
  { id: "health", label: "Health & wellness", group: "industry", words: /\b(health(care)?|wellness|medical|clinic|fitness|mental health|therapy|meditation|sleep|nutrition|pharma)\b/i },
  { id: "food", label: "Food & drink", group: "industry", words: /\b(restaurant|food|coffee|wine|beer|recipes?|bakery|caf[eé]|drinks?|brewery|chocolate|kitchen)\b/i },
  { id: "fashion", label: "Fashion & beauty", group: "industry", words: /\b(fashion|apparel|clothing|beauty|skincare|cosmetics|jewel(le)?ry|sneakers|streetwear|fragrance)\b/i },
  { id: "space", label: "Architecture & interiors", group: "industry", words: /\b(architect(ure|s)?|interior( design)?|furniture|real estate|propert(y|ies)|residences?|construction)\b/i },
  { id: "travel", label: "Travel & hospitality", group: "industry", words: /\b(travel|hotels?|resort|tourism|hospitality|airlines?|vacation|holiday|destinations?)\b/i },
  { id: "culture", label: "Music, film & games", group: "industry", words: /\b(music|album|band|record label|film|movie|cinema|documentary|games?|gaming|esports|entertainment)\b/i },
  { id: "education", label: "Education", group: "industry", words: /\b(education|online courses?|e-?learning|school|university|academy|students?|teachers?)\b/i },
  { id: "impact", label: "Nonprofit & climate", group: "industry", words: /\b(non-?profit|charity|foundation|climate|sustainab(le|ility)|social impact|ngo|carbon|renewable)\b/i },
];

export const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
