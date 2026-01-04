import phonicsData from './phonicsData.js';

const PATTERN_TO_IPA = {};
const categories = ['letters', 'short_vowels', 'long_vowels', 'consonant_blends', 'r_controlled', 'other_vowels'];
categories.forEach(category => {
  const patterns = phonicsData[category] || [];
  patterns.forEach(patternData => {
    const ipa = patternData.pronunciation.replace(/\//g, '');
    PATTERN_TO_IPA[`${category}:${patternData.pattern}`] = ipa;
  });
});

export class RuleMatcher {
  constructor(dictionaryService = null) {
    this.dictionary = dictionaryService;
    this.patternIndex = this.buildPatternIndex();
  }

  setDictionary(dictionaryService) {
    this.dictionary = dictionaryService;
  }

  buildPatternIndex() {
    const index = {};
    const categories = ['letters', 'short_vowels', 'long_vowels', 'consonant_blends', 'r_controlled', 'other_vowels'];
    
    categories.forEach(category => {
      const patterns = phonicsData[category] || [];
      patterns.forEach(patternData => {
        patternData.words.forEach(wordInfo => {
          const word = wordInfo.word.toLowerCase();
          if (!index[word]) {
            index[word] = [];
          }
          index[word].push({
            category,
            pattern: patternData.pattern,
            pronunciation: patternData.pronunciation,
            ruleKey: patternData.ruleKey || null,
            highlight: wordInfo.highlight
          });
        });
      });
    });
    
    return index;
  }

  matchMultiple(word, activeRules = []) {
    const lowerWord = word.toLowerCase();
    
    if (!activeRules || activeRules.length === 0) {
      return { matched: false };
    }

    if (!this.dictionary) {
      return { matched: false };
    }

    const wordIPA = this.dictionary.getIPA(lowerWord);
    if (!wordIPA) {
      return { matched: false };
    }

    const ipaContent = wordIPA.replace(/\//g, '');
    
    const directMatch = this.patternIndex[lowerWord];
    if (directMatch) {
      for (const rule of activeRules) {
        const patternMatch = directMatch.find(
          m => m.category === rule.category && m.pattern === rule.pattern
        );
        if (patternMatch) {
          const targetIPA = PATTERN_TO_IPA[`${rule.category}:${rule.pattern}`];
          if (targetIPA && ipaContent.includes(targetIPA)) {
            return { matched: true, ...patternMatch };
          }
        }
      }
    }

    const patternMatch = this.matchByActiveRules(lowerWord, activeRules, ipaContent);
    if (patternMatch) {
      return patternMatch;
    }

    return { matched: false };
  }

  match(word, currentCategory, currentPattern = null) {
    // Legacy support or fallback if needed, but matchMultiple is primary now.
    // Construct a temporary activeRules array
    const rule = { category: currentCategory, pattern: currentPattern };
    return this.matchMultiple(word, [rule]);
  }

  matchByActiveRules(word, activeRules, ipaContent) {
    for (const rule of activeRules) {
      const targetIPA = PATTERN_TO_IPA[`${rule.category}:${rule.pattern}`];
      if (!targetIPA || !ipaContent.includes(targetIPA)) {
        continue;
      }
      
      // Basic match construction
      return {
        matched: true,
        category: rule.category,
        pattern: rule.pattern,
        pronunciation: rule.pronunciation,
        ruleKey: null,
        highlight: rule.pattern
      };
    }
    return null;
  }

  getAllPatterns(category) {
    return phonicsData[category] || [];
  }

  getCategories() {
    return Object.keys(phonicsData.categoryDescriptions);
  }

  getCategoryDescription(category) {
    return phonicsData.categoryDescriptions[category] || null;
  }
}
