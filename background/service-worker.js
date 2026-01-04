import { DictionaryService } from '../data/dictionary.js';
import { RuleMatcher } from '../data/rule-matcher.js';

const dictionary = new DictionaryService();
const ruleMatcher = new RuleMatcher(dictionary);

let dictionaryReady = false;
let dictionaryLoadPromise = null;

async function ensureDictionaryLoaded() {
  if (dictionaryReady) return;
  if (!dictionaryLoadPromise) {
    dictionaryLoadPromise = dictionary.loadDictionary().then(() => {
      dictionaryReady = true;
      console.log('Phonics Focus: 词典加载完成');
    });
  }
  return dictionaryLoadPromise;
}

ensureDictionaryLoaded();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', timestamp: Date.now(), dictionaryReady });
    return true;
  }

  if (message.type === 'ANALYZE_WORD') {
    ensureDictionaryLoaded().then(() => {
      const { word, activeRules } = message;
      const result = analyzeWord(word, activeRules);
      sendResponse(result);
    });
    return true;
  }

  if (message.type === 'ANALYZE_BATCH') {
    ensureDictionaryLoaded().then(() => {
      const { words, activeRules } = message;
      const results = words.map(word => analyzeWord(word, activeRules));
      sendResponse(results);
    });
    return true;
  }

  if (message.type === 'GET_IPA') {
    ensureDictionaryLoaded().then(() => {
      const ipa = dictionary.getIPA(message.word);
      sendResponse({ word: message.word, ipa });
    });
    return true;
  }

  if (message.type === 'GET_AUDIO_URL') {
    const { word, source = 'free_dictionary' } = message;
    getAudioUrl(word, source)
      .then(audioUrl => {
        sendResponse({ success: true, audioUrl });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'GET_MESSAGES') {
    const { lang } = message;
    const locale = lang === 'zh' ? 'zh' : 'en';
    const path = `_locales/${locale}/messages.json`;

    fetch(chrome.runtime.getURL(path))
      .then(response => response.json())
      .then(messages => sendResponse({ success: true, messages }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true;
  }

  return false;
});

function analyzeWord(word, activeRules) {
  const ipa = dictionary.getIPA(word);
  const match = ruleMatcher.matchMultiple(word, activeRules);

  return {
    word,
    ipa,
    matched: match.matched,
    pattern: match.pattern,
    pronunciation: match.pronunciation,
    highlight: match.highlight,
    rule: match.rule
  };
}

async function getAudioUrl(word, source) {
  const encodedWord = encodeURIComponent(word.toLowerCase());
  
  switch (source) {
    case 'youdao':
      return `https://dict.youdao.com/dictvoice?audio=${encodedWord}&type=2`;
    
    case 'baidu':
      return `https://fanyi.baidu.com/gettts?lan=en&text=${encodedWord}&spd=3&source=web`;
    
    case 'google':
      return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodedWord}`;
    
    case 'free_dictionary':
    default:
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodedWord}`);
      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();
      const phonetics = data[0]?.phonetics || [];
      const audioUrl = phonetics.find(p => p.audio && p.audio.length > 0)?.audio || null;
      if (!audioUrl) throw new Error('No audio found');
      return audioUrl;
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      enabled: true,
      currentRule: 'short_vowels',
      activeRules: [{ category: 'short_vowels', pattern: 'at', pronunciation: '/æt/' }],
      highlightStyle: 'underline'
    });
    console.log('Phonics Focus 首次安装，已设置默认值');
  } else if (details.reason === 'update') {
    const existing = await chrome.storage.local.get(['activeRules']);
    if (!existing.activeRules || !Array.isArray(existing.activeRules)) {
      chrome.storage.local.set({
        activeRules: [{ category: 'short_vowels', pattern: 'at', pronunciation: '/æt/' }]
      });
    }
    console.log('Phonics Focus 已更新，保留用户数据');
  }
});
