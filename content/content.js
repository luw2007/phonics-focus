class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }
}

class PhonicsHighlighter {
  constructor() {
    this.enabled = false;
    this.currentRule = null;
    this.activeRules = [];
    this.highlightStyle = 'underline';
    this.processedNodes = new WeakSet();
    this.tooltip = null;
    this.observer = null;
    this.hideTooltipTimer = null;
    this.currentHighlight = null;
    this.ttsConfig = {
      source: 'tts',
      voiceURI: '',
      rate: 1.0
    };
    this.highlightColor = '#ff6b35';
    this.voices = [];
    this.wordCache = new LRUCache(1000); // Cache up to 1000 words
    this.keepAliveInterval = null;
    this.currentMessages = null;
    this.currentLang = 'auto';
  }

  async init() {
    await this.loadSettings();
    await this.loadMessages(this.currentLang);
    this.createTooltip();
    this.setupIntersectionObserver();
    this.setupMutationObserver();
    this.listenForMessages();
    this.startKeepAlive();

    if (this.enabled) {
      this.processVisibleContent();
    }
  }

  startKeepAlive() {
    // Send a ping message every 20 seconds to keep the Service Worker alive
    // while the user is actively viewing a page with Phonics Focus enabled
    this.keepAliveInterval = setInterval(() => {
      if (this.enabled) {
        chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
          if (chrome.runtime.lastError) {
            // Service worker might be down, it will restart on next user action
            console.debug('Phonics Focus: Keep-alive ping failed', chrome.runtime.lastError);
          }
        });
      }
    }, 20000);
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      'enabled',
      'currentRule',
      'activeRules',
      'highlightStyle',
      'ttsConfig',
      'highlightColor',
      'uiLanguage'
    ]);

    this.enabled = settings.enabled ?? true;
    this.currentRule = settings.currentRule ?? 'short_vowels';
    this.activeRules = settings.activeRules ?? [];
    this.highlightStyle = settings.highlightStyle ?? 'underline';
    this.highlightColor = settings.highlightColor ?? '#ff6b35';
    this.currentLang = settings.uiLanguage ?? 'auto';
    this.ttsConfig = settings.ttsConfig ?? {
      source: 'tts',
      voiceURI: '',
      rate: 1.0
    };

    this.loadVoices();
    this.applyAccentColor(this.highlightColor);
  }

  async loadMessages(lang) {
    if (lang === 'auto') {
      this.currentMessages = null;
      return;
    }
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_MESSAGES', lang }, (response) => {
        if (response && response.success) {
          this.currentMessages = response.messages;
        }
        resolve();
      });
    });
  }

  getMessage(key) {
    if (this.currentMessages && this.currentMessages[key]) {
      return this.currentMessages[key].message;
    }
    return chrome.i18n.getMessage(key);
  }

  loadVoices() {
    const populateVoices = () => {
      this.voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    };
    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'phonics-tooltip';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);

    this.tooltip.addEventListener('mouseenter', () => {
      this.cancelHideTooltip();
    });
    this.tooltip.addEventListener('mouseleave', () => {
      this.scheduleHideTooltip();
    });
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting && this.enabled) {
            // Spread processing load to avoid blocking main thread during fast scrolling
            setTimeout(() => {
              if (this.enabled) { // Check enabled again in case it changed
                this.processElement(entry.target);
              }
            }, index * 20);
          }
        });
      },
      { rootMargin: '100px' }
    );
  }

  setupMutationObserver() {
    const mutationObserver = new MutationObserver((mutations) => {
      if (!this.enabled) return;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.observer.observe(node);
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  listenForMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SETTINGS_CHANGED') {
        this.handleSettingsChange(message.settings);
        sendResponse({ success: true });
      }
      return true;
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        this.enabled = changes.enabled.newValue;
        if (this.enabled) {
          this.processVisibleContent();
        } else {
          this.removeAllHighlights();
        }
      }
      if (changes.currentRule) {
        this.currentRule = changes.currentRule.newValue;
        // Don't refresh just on category change, only on activeRules change
      }
      if (changes.activeRules) {
        this.activeRules = changes.activeRules.newValue;
        this.wordCache.clear(); // Clear cache when rules change
        this.refreshHighlights();
      }
      if (changes.highlightStyle) {
        this.highlightStyle = changes.highlightStyle.newValue;
        this.updateHighlightStyle();
      }
      if (changes.highlightColor) {
        this.highlightColor = changes.highlightColor.newValue;
        this.applyAccentColor(this.highlightColor);
      }
      if (changes.ttsConfig) {
        this.ttsConfig = changes.ttsConfig.newValue;
      }
      if (changes.uiLanguage) {
        this.currentLang = changes.uiLanguage.newValue;
        this.loadMessages(this.currentLang);
      }
    });
  }

  handleSettingsChange(settings) {
    Object.assign(this, settings);
    if (this.enabled) {
      this.refreshHighlights();
    } else {
      this.removeAllHighlights();
    }
  }

  processVisibleContent() {
    const elements = document.querySelectorAll('p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, a, label');
    elements.forEach(el => {
      if (!this.isExcludedElement(el)) {
        this.observer.observe(el);
      }
    });
  }

  isExcludedElement(element) {
    const excludedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'];
    return excludedTags.includes(element.tagName) ||
      element.closest('script, style, noscript, iframe, textarea, input, code, pre');
  }

  async processElement(element) {
    if (this.processedNodes.has(element)) return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.parentElement?.closest('.phonics-highlight, .phonics-tooltip')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.textContent.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    const words = this.extractWords(textNodes);
    if (words.length === 0) return;

    const results = await this.analyzeWords(words.map(w => w.word));

    this.applyHighlights(textNodes, words, results);
    this.processedNodes.add(element);
  }

  extractWords(textNodes) {
    const words = [];
    const wordRegex = /\b[a-zA-Z]+\b/g;

    textNodes.forEach((node, nodeIndex) => {
      const text = node.textContent;
      let match;
      while ((match = wordRegex.exec(text)) !== null) {
        words.push({
          word: match[0].toLowerCase(),
          original: match[0],
          nodeIndex,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    });

    return words;
  }

  async analyzeWords(words) {
    const uniqueWords = [...new Set(words)];
    const wordsToAnalyze = [];
    const resultMap = {};

    // Check cache first
    uniqueWords.forEach(word => {
      if (this.wordCache.has(word)) {
        resultMap[word] = this.wordCache.get(word);
      } else {
        wordsToAnalyze.push(word);
      }
    });

    if (wordsToAnalyze.length === 0) {
      return resultMap;
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'ANALYZE_BATCH',
          words: wordsToAnalyze,
          activeRules: this.activeRules
        },
        (response) => {
          response?.forEach(r => {
            resultMap[r.word] = r;
            this.wordCache.set(r.word, r);
          });
          resolve(resultMap);
        }
      );
    });
  }

  applyHighlights(textNodes, words, results) {
    const nodeReplacements = new Map();

    words.forEach(wordInfo => {
      const result = results[wordInfo.word];
      if (!result?.matched) return;

      const node = textNodes[wordInfo.nodeIndex];
      if (!nodeReplacements.has(node)) {
        nodeReplacements.set(node, []);
      }
      nodeReplacements.get(node).push({
        ...wordInfo,
        result
      });
    });

    nodeReplacements.forEach((replacements, node) => {
      replacements.sort((a, b) => b.start - a.start);

      let html = node.textContent;
      replacements.forEach(({ original, start, end, result }) => {
        const before = html.slice(0, start);
        const after = html.slice(end);
        const highlighted = this.createHighlightHTML(original, result);
        html = before + highlighted + after;
      });

      const wrapper = document.createElement('span');
      wrapper.innerHTML = html;

      const fragment = document.createDocumentFragment();
      while (wrapper.firstChild) {
        fragment.appendChild(wrapper.firstChild);
      }

      node.parentNode.insertBefore(fragment, node);
      node.parentNode.removeChild(node);
    });

    this.attachTooltipListeners();
  }

  createHighlightHTML(word, result) {
    const data = encodeURIComponent(JSON.stringify({
      word,
      ipa: result.ipa,
      pattern: result.pattern,
      pronunciation: result.pronunciation,
      rule: result.rule
    }));

    if (this.highlightStyle === 'inline') {
      const ipaDisplay = result.ipa || '';
      return `<span class="phonics-highlight phonics-style-inline" data-phonics="${data}">${word}<span class="phonics-ipa-inline">(${ipaDisplay})</span></span>`;
    }

    return `<span class="phonics-highlight phonics-style-${this.highlightStyle}" data-phonics="${data}">${word}</span>`;
  }

  attachTooltipListeners() {
    document.querySelectorAll('.phonics-highlight').forEach(el => {
      if (el.dataset.listenerAttached) return;

      el.addEventListener('mouseenter', (e) => {
        this.cancelHideTooltip();
        this.showTooltip(e);
      });
      el.addEventListener('mouseleave', () => {
        this.scheduleHideTooltip();
      });
      el.dataset.listenerAttached = 'true';
    });
  }

  showTooltip(event) {
    const target = event.target;
    const data = JSON.parse(decodeURIComponent(target.dataset.phonics));

    const noIpa = this.getMessage('tooltip_no_ipa');
    const rulePrefix = this.getMessage('tooltip_rule_prefix');
    const speakText = this.getMessage('tooltip_speak');
    this.tooltip.innerHTML = `
      <div class="phonics-tooltip-word">${data.word}</div>
      <div class="phonics-tooltip-ipa">${data.ipa || noIpa}</div>
      <div class="phonics-tooltip-rule">${rulePrefix} ${data.pattern} ${data.pronunciation}</div>
      <button class="phonics-tooltip-speak" data-word="${data.word}">${speakText}</button>
    `;

    const speakBtn = this.tooltip.querySelector('.phonics-tooltip-speak');
    speakBtn.addEventListener('click', () => this.speak(data.word));

    const rect = target.getBoundingClientRect();
    this.tooltip.style.left = `${rect.left + window.scrollX}px`;
    this.tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    this.tooltip.style.display = 'block';
  }

  scheduleHideTooltip() {
    this.hideTooltipTimer = setTimeout(() => {
      this.hideTooltip();
    }, 100);
  }

  cancelHideTooltip() {
    if (this.hideTooltipTimer) {
      clearTimeout(this.hideTooltipTimer);
      this.hideTooltipTimer = null;
    }
  }

  hideTooltip() {
    this.tooltip.style.display = 'none';
    this.currentHighlight = null;
  }

  speak(word) {
    if (this.ttsConfig.source === 'human') {
      this.speakHuman(word);
    } else {
      this.speakTTS(word);
    }
  }

  speakHuman(word) {
    chrome.runtime.sendMessage(
      { type: 'GET_AUDIO_URL', word, source: this.ttsConfig.humanSource || 'free_dictionary' },
      (response) => {
        if (response?.success && response.audioUrl) {
          const audio = new Audio(response.audioUrl);
          audio.play().catch(() => {
            this.speakTTS(word);
          });
        } else {
          this.speakTTS(word);
        }
      }
    );
  }

  speakTTS(word) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = this.ttsConfig.rate || 1.0;

    if (this.ttsConfig.voiceURI) {
      const selectedVoice = this.voices.find(v => v.voiceURI === this.ttsConfig.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    speechSynthesis.speak(utterance);
  }

  removeAllHighlights() {
    document.querySelectorAll('.phonics-highlight').forEach(el => {
      const text = document.createTextNode(el.textContent);
      el.parentNode.replaceChild(text, el);
    });
    this.processedNodes = new WeakSet();
  }

  refreshHighlights() {
    this.removeAllHighlights();
    this.processVisibleContent();
  }

  updateHighlightStyle() {
    document.querySelectorAll('.phonics-highlight').forEach(el => {
      el.className = `phonics-highlight phonics-style-${this.highlightStyle}`;
    });
  }

  applyAccentColor(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return;
    const base = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
    const hover = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    document.documentElement.style.setProperty('--phonics-bg-color', base);
    document.documentElement.style.setProperty('--phonics-bg-color-hover', hover);
    document.documentElement.style.setProperty('--phonics-text-color', hex);
  }

  hexToRgb(hex) {
    if (!hex) return null;
    let v = hex.trim().toLowerCase();
    if (!v.startsWith('#')) v = '#' + v;
    if (v.length === 4 && /^#([0-9a-f]{3})$/.test(v)) {
      const r = v[1], g = v[2], b = v[3];
      v = `#${r}${r}${g}${g}${b}${b}`;
    }
    const m = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
}

const highlighter = new PhonicsHighlighter();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => highlighter.init());
} else {
  highlighter.init();
}
