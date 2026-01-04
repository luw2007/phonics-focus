import phonicsData from '../data/phonicsData.js';

let currentMessages = null;
let currentLang = 'auto';

async function loadMessages(lang) {
  if (lang === 'auto') {
    currentMessages = null;
    return;
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_MESSAGES', lang }, (response) => {
      if (response && response.success) {
        currentMessages = response.messages;
      }
      resolve();
    });
  });
}

function getMessage(key) {
  if (currentMessages && currentMessages[key]) {
    return currentMessages[key].message;
  }
  return chrome.i18n.getMessage(key);
}

function applyI18n() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const msg = getMessage(key);
    if (!msg) return;
    if (attr) {
      el.setAttribute(attr, msg);
    } else {
      el.textContent = msg;
    }
  });
  const titleMsg = getMessage('title');
  if (titleMsg) {
    document.title = titleMsg;
  }
}

class PopupController {
  constructor() {
    this.enableToggle = document.getElementById('enableToggle');
    this.categorySelect = document.getElementById('categorySelect');
    this.patternTags = document.getElementById('patternTags');
    this.activeRulesList = document.getElementById('activeRulesList');
    this.ruleName = document.getElementById('ruleName');
    this.rulePattern = document.getElementById('rulePattern');
    this.ruleExamples = document.getElementById('ruleExamples');
    this.styleInputs = document.querySelectorAll('input[name="highlightStyle"]');
    this.colorConfigPanel = document.getElementById('colorConfigPanel');
    this.colorPresets = document.getElementById('colorPresets');
    this.hexInput = document.getElementById('hexInput');
    this.nativeColorPicker = document.getElementById('nativeColorPicker');
    this.bgColorInput = document.getElementById('bgColorInput');
    this.bgColorSwatches = document.getElementById('bgColorSwatches');

    this.ttsModeInputs = document.querySelectorAll('input[name="ttsMode"]');
    this.voiceSelect = document.getElementById('voiceSelect');
    this.voicePreviewBtn = document.getElementById('voicePreviewBtn');
    this.ttsRateSlider = document.getElementById('ttsRate');
    this.rateValueDisplay = document.getElementById('rateValue');
    this.ttsVoiceSettings = document.getElementById('ttsVoiceSettings');
    this.humanVoiceSettings = document.getElementById('humanVoiceSettings');
    this.humanSourceSelect = document.getElementById('humanSourceSelect');
    this.humanPreviewBtn = document.getElementById('humanPreviewBtn');
    this.uiLangSelect = document.getElementById('uiLangSelect');

    this.activeRules = [];
    this.focusedRule = null;
    this.voices = [];
    this.highlightColor = '#ff6b35';
    this.currentPlayIndex = 0;
    this.lastRenderedPattern = null;

    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
    this.renderActiveRulesList();
    this.updatePatternOptions();
    this.updateRuleCard();
    this.loadVoices();
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

    this.enableToggle.checked = settings.enabled ?? true;
    this.categorySelect.value = settings.currentRule ?? 'short_vowels';
    this.highlightStyle = settings.highlightStyle ?? 'underline';
    this.highlightColor = settings.highlightColor ?? '#ff6b35';
    currentLang = settings.uiLanguage ?? 'auto';

    if (this.uiLangSelect) {
      this.uiLangSelect.value = currentLang;
    }

    await loadMessages(currentLang);
    applyI18n();

    this.ttsConfig = settings.ttsConfig ?? {
      source: 'tts',
      voiceURI: '',
      rate: 1.0,
      humanSource: 'free_dictionary'
    };

    if (!this.ttsConfig.humanSource) {
      this.ttsConfig.humanSource = 'free_dictionary';
    }

    if (settings.activeRules && Array.isArray(settings.activeRules)) {
      this.activeRules = settings.activeRules;
    } else {
      const defaultRule = phonicsData.short_vowels[0];
      this.activeRules = [{
        category: 'short_vowels',
        pattern: defaultRule.pattern,
        pronunciation: defaultRule.pronunciation
      }];
    }

    if (this.activeRules.length > 0) {
      this.focusedRule = this.activeRules[this.activeRules.length - 1];
    }

    this.styleInputs.forEach(input => {
      input.checked = input.value === this.highlightStyle;
    });

    this.updateColorUI(this.highlightColor);
    this.updateColorPanelVisibility();

    this.ttsModeInputs.forEach(input => {
      input.checked = input.value === this.ttsConfig.source;
    });
    this.ttsRateSlider.value = this.ttsConfig.rate;
    this.rateValueDisplay.textContent = `${this.ttsConfig.rate}${getMessage('rate_unit_suffix')}`;
    this.humanSourceSelect.value = this.ttsConfig.humanSource;
    this.updateTtsSettingsVisibility();
  }

  bindEvents() {
    this.enableToggle.addEventListener('change', () => {
      chrome.storage.local.set({ enabled: this.enableToggle.checked });
    });

    this.categorySelect.addEventListener('change', () => {
      chrome.storage.local.set({ currentRule: this.categorySelect.value });
      this.updatePatternOptions();
    });

    this.styleInputs.forEach(input => {
      input.addEventListener('change', () => {
        chrome.storage.local.set({ highlightStyle: input.value });
        this.highlightStyle = input.value;
        this.updateColorPanelVisibility();
      });
    });

    if (this.uiLangSelect) {
      this.uiLangSelect.addEventListener('change', async () => {
        currentLang = this.uiLangSelect.value;
        chrome.storage.local.set({ uiLanguage: currentLang });
        await loadMessages(currentLang);
        applyI18n();
        this.rateValueDisplay.textContent = `${this.ttsConfig.rate}${getMessage('rate_unit_suffix')}`;
        this.renderActiveRulesList();
        this.updateRuleCard();
        this.loadVoices();
      });
    }

    if (this.colorPresets) {
      this.colorPresets.querySelectorAll('.color-dot').forEach(btn => {
        btn.addEventListener('click', () => {
          const color = btn.getAttribute('data-color');
          this.setHighlightColor(color);
        });
      });
    }

    if (this.nativeColorPicker) {
      this.nativeColorPicker.addEventListener('input', (e) => {
        this.setHighlightColor(e.target.value);
      });
    }

    if (this.hexInput) {
      this.hexInput.addEventListener('input', () => {
        const normalized = this.normalizeHex(this.hexInput.value);
        if (normalized) {
          this.setHighlightColor(normalized);
        }
      });

      this.hexInput.addEventListener('blur', () => {
        this.updateColorUI(this.highlightColor);
      });
    }

    this.ttsModeInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.ttsConfig.source = input.value;
        this.saveTtsConfig();
        this.updateTtsSettingsVisibility();
      });
    });

    this.voiceSelect.addEventListener('change', () => {
      this.ttsConfig.voiceURI = this.voiceSelect.value;
      this.saveTtsConfig();
    });

    this.voicePreviewBtn.addEventListener('click', () => {
      this.previewVoice();
    });

    this.ttsRateSlider.addEventListener('input', () => {
      const rate = parseFloat(this.ttsRateSlider.value);
      this.rateValueDisplay.textContent = `${rate}${chrome.i18n.getMessage('rate_unit_suffix')}`;
      this.ttsConfig.rate = rate;
      this.saveTtsConfig();
    });

    this.humanSourceSelect.addEventListener('change', () => {
      this.ttsConfig.humanSource = this.humanSourceSelect.value;
      this.saveTtsConfig();
    });

    this.humanPreviewBtn.addEventListener('click', () => {
      this.previewHumanVoice();
    });

    // Accordion Logic
    this.setupAccordion('styleAccordionBtn', 'styleAccordionContent');
    this.setupAccordion('voiceAccordionBtn', 'voiceAccordionContent');
  }

  setupAccordion(btnId, contentId) {
    const btn = document.getElementById(btnId);
    const content = document.getElementById(contentId);

    if (btn && content) {
      btn.addEventListener('click', () => {
        const isHidden = content.classList.contains('hidden');

        // Close all other accordions (optional, for "one open at a time" behavior)
        document.querySelectorAll('.accordion-content').forEach(el => {
          if (el.id !== contentId) {
            el.classList.add('hidden');
            el.previousElementSibling.classList.remove('active');
          }
        });

        if (isHidden) {
          content.classList.remove('hidden');
          btn.classList.add('active');
        } else {
          content.classList.add('hidden');
          btn.classList.remove('active');
        }
      });
    }
  }

  normalizeHex(value) {
    if (!value) return null;
    let v = value.trim().toLowerCase();
    if (!v.startsWith('#')) v = '#' + v;
    if (v.length === 4 && /^#([0-9a-f]{3})$/.test(v)) {
      const r = v[1], g = v[2], b = v[3];
      v = `#${r}${r}${g}${g}${b}${b}`;
    }
    if (/^#([0-9a-f]{6})$/.test(v)) return v;
    return null;
  }

  setHighlightColor(color) {
    this.highlightColor = color;
    this.updateColorUI(color);
    chrome.storage.local.set({ highlightColor: color });
  }

  updateColorPanelVisibility() {
    if (this.colorConfigPanel) {
      this.colorConfigPanel.classList.remove('hidden');
    }
  }

  updateColorUI(color) {
    if (this.hexInput) {
      this.hexInput.value = color.replace('#', '');
    }

    if (this.nativeColorPicker) {
      this.nativeColorPicker.value = color;
    }

    if (this.colorPresets) {
      this.colorPresets.querySelectorAll('.color-dot').forEach(dot => {
        if (dot.getAttribute('data-color').toLowerCase() === color.toLowerCase()) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }
  }

  togglePattern(item) {
    const category = this.categorySelect.value;
    const existingIndex = this.activeRules.findIndex(r =>
      r.category === category && r.pattern === item.pattern
    );

    if (existingIndex > -1) {
      this.activeRules.splice(existingIndex, 1);
      // If we removed the focused rule, focus on the last one available
      if (this.focusedRule &&
        this.focusedRule.category === category &&
        this.focusedRule.pattern === item.pattern) {
        this.focusedRule = this.activeRules.length > 0 ? this.activeRules[this.activeRules.length - 1] : null;
      }
    } else {
      const newRule = {
        category: category,
        pattern: item.pattern,
        pronunciation: item.pronunciation
      };
      this.activeRules.push(newRule);
      this.focusedRule = newRule;
    }

    this.saveActiveRules();
    this.renderActiveRulesList();
    this.updatePatternOptions();
    this.updateRuleCard();
  }

  removeRule(e, index) {
    e.stopPropagation();
    const removedRule = this.activeRules[index];
    this.activeRules.splice(index, 1);

    if (this.focusedRule &&
      this.focusedRule.category === removedRule.category &&
      this.focusedRule.pattern === removedRule.pattern) {
      this.focusedRule = this.activeRules.length > 0 ? this.activeRules[this.activeRules.length - 1] : null;
    }

    this.saveActiveRules();
    this.renderActiveRulesList();
    this.updatePatternOptions();
    this.updateRuleCard();
  }

  focusRule(rule) {
    this.focusedRule = rule;
    this.renderActiveRulesList();
    this.updateRuleCard();
  }

  saveActiveRules() {
    chrome.storage.local.set({ activeRules: this.activeRules });
  }

  renderActiveRulesList() {
    this.activeRulesList.innerHTML = '';

    this.activeRules.forEach((rule, index) => {
      const chip = document.createElement('div');
      chip.className = 'active-rule-chip';

      if (this.focusedRule &&
        this.focusedRule.category === rule.category &&
        this.focusedRule.pattern === rule.pattern) {
        chip.classList.add('active');
      }

      const text = document.createElement('span');
      text.className = 'chip-text';
      text.textContent = `${rule.pattern} ${rule.pronunciation}`;

      const removeBtn = document.createElement('span');
      removeBtn.className = 'chip-remove';
      removeBtn.textContent = getMessage('chip_remove_symbol') || '×';
      removeBtn.addEventListener('click', (e) => this.removeRule(e, index));

      chip.appendChild(text);
      chip.appendChild(removeBtn);

      chip.addEventListener('click', () => this.focusRule(rule));

      this.activeRulesList.appendChild(chip);
    });

    // Scroll to the active chip
    const activeChip = this.activeRulesList.querySelector('.active-rule-chip.active');
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  updatePatternOptions() {
    const category = this.categorySelect.value;
    const patterns = phonicsData[category] || [];

    this.patternTags.innerHTML = '';

    patterns.forEach(item => {
      const tag = document.createElement('span');
      tag.className = 'pattern-tag';

      const isActive = this.activeRules.some(r =>
        r.category === category && r.pattern === item.pattern
      );

      if (isActive) {
        tag.classList.add('selected');
      }

      const patternSpan = document.createElement('span');
      patternSpan.className = 'tag-pattern';
      patternSpan.textContent = item.pattern;

      const pronunciationSpan = document.createElement('span');
      pronunciationSpan.className = 'tag-pronunciation';
      pronunciationSpan.textContent = item.pronunciation;

      tag.appendChild(patternSpan);
      tag.appendChild(pronunciationSpan);

      tag.addEventListener('click', () => this.togglePattern(item));

      this.patternTags.appendChild(tag);
    });
  }

  updateRuleCard() {
    if (!this.focusedRule) {
      // Clear card or show placeholder
      this.ruleName.textContent = getMessage('please_select_rule');
      this.rulePattern.textContent = getMessage('dash_symbol');
      this.ruleExamples.innerHTML = '';
      return;
    }

    const { category, pattern, pronunciation } = this.focusedRule;
    const categoryDesc = phonicsData.categoryDescriptions[category];

    // Find pattern data to get examples
    const patterns = phonicsData[category] || [];
    const patternData = patterns.find(p => p.pattern === pattern);

    // Update header to show Category + Pattern info
    this.ruleName.textContent = categoryDesc?.name || category;

    // Reset play index if pattern changed
    if (this.lastRenderedPattern !== pattern) {
      this.currentPlayIndex = 0;
      this.lastRenderedPattern = pattern;
    }

    this.rulePattern.innerHTML = '';
    const textSpan = document.createElement('span');
    textSpan.textContent = `${pattern} ${pronunciation}`;
    this.rulePattern.appendChild(textSpan);

    if (patternData) {
      const playBtn = document.createElement('span');
      playBtn.className = 'play-icon';
      playBtn.title = getMessage('preview_title') || 'Play';
      playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>`;
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playPhonicsSound(patternData);
      });
      this.rulePattern.appendChild(playBtn);
    }

    this.ruleExamples.innerHTML = '';
    if (patternData && patternData.words) {
      patternData.words.slice(0, 4).forEach(wordData => {
        const span = document.createElement('span');
        span.className = 'example-word';
        span.textContent = wordData.word;
        this.ruleExamples.appendChild(span);
      });
    }
  }

  playPhonicsSound(patternData) {
    if (!patternData || !patternData.words || patternData.words.length === 0) return;

    // Use the currentPlayIndex to select the word
    const wordsToPlay = patternData.words.slice(0, 4); // Limit to visible words
    if (wordsToPlay.length === 0) return;

    // Ensure index is within bounds (in case words changed)
    if (this.currentPlayIndex >= wordsToPlay.length) {
      this.currentPlayIndex = 0;
    }

    const wordToPlay = wordsToPlay[this.currentPlayIndex].word;

    // Visual feedback
    const wordElements = this.ruleExamples.querySelectorAll('.example-word');
    const activeElement = wordElements[this.currentPlayIndex];

    // Reset all styles
    wordElements.forEach(el => el.classList.remove('playing'));

    // Highlight current
    if (activeElement) {
      activeElement.classList.add('playing');
    }

    // Update index for next click
    this.currentPlayIndex = (this.currentPlayIndex + 1) % wordsToPlay.length;

    const onEndCallback = () => {
      if (activeElement) {
        activeElement.classList.remove('playing');
      }
    };

    if (this.ttsConfig.source === 'tts') {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(wordToPlay);
      utterance.lang = 'en-US';
      utterance.rate = this.ttsConfig.rate;

      const selectedVoice = this.voices.find(v => v.voiceURI === this.ttsConfig.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = onEndCallback;
      utterance.onerror = onEndCallback;

      speechSynthesis.speak(utterance);
    } else {
      // Human voice
      chrome.runtime.sendMessage(
        { type: 'GET_AUDIO_URL', word: wordToPlay, source: this.ttsConfig.humanSource },
        (response) => {
          if (response?.success && response.audioUrl) {
            const audio = new Audio(response.audioUrl);
            audio.onended = onEndCallback;
            audio.onerror = onEndCallback;
            audio.play().catch(() => {
              // Fail silently
              console.error('Audio play failed');
              onEndCallback();
            });
          } else {
            onEndCallback();
          }
        }
      );
    }
  }

  loadVoices() {
    const populateVoices = () => {
      this.voices = speechSynthesis.getVoices()
        .filter(v => v.lang.startsWith('en'))
        .sort((a, b) => {
          const aIsGoogle = a.name.includes('Google');
          const bIsGoogle = b.name.includes('Google');
          if (aIsGoogle && !bIsGoogle) return -1;
          if (!aIsGoogle && bIsGoogle) return 1;
          return a.name.localeCompare(b.name);
        });

      this.voiceSelect.innerHTML = '';

      if (this.voices.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = getMessage('no_voices_detected');
        this.voiceSelect.appendChild(opt);
        return;
      }

      this.voices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        const source = voice.localService ? getMessage('voice_source_system') : getMessage('voice_source_online');
        opt.textContent = `${voice.name} (${source})`;
        this.voiceSelect.appendChild(opt);
      });

      if (this.ttsConfig.voiceURI) {
        const exists = this.voices.some(v => v.voiceURI === this.ttsConfig.voiceURI);
        if (exists) {
          this.voiceSelect.value = this.ttsConfig.voiceURI;
        } else {
          this.voiceSelect.value = this.voices[0]?.voiceURI || '';
          this.ttsConfig.voiceURI = this.voiceSelect.value;
          this.saveTtsConfig();
        }
      } else if (this.voices.length > 0) {
        this.voiceSelect.value = this.voices[0].voiceURI;
        this.ttsConfig.voiceURI = this.voices[0].voiceURI;
        this.saveTtsConfig();
      }
    };

    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }
  }

  previewVoice() {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('hello');
    utterance.lang = 'en-US';
    utterance.rate = this.ttsConfig.rate;

    const selectedVoice = this.voices.find(v => v.voiceURI === this.voiceSelect.value);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    speechSynthesis.speak(utterance);
  }

  saveTtsConfig() {
    chrome.storage.local.set({ ttsConfig: this.ttsConfig });
  }

  updateTtsSettingsVisibility() {
    if (this.ttsConfig.source === 'tts') {
      this.ttsVoiceSettings.classList.remove('hidden');
      this.humanVoiceSettings.classList.add('hidden');
    } else {
      this.ttsVoiceSettings.classList.add('hidden');
      this.humanVoiceSettings.classList.remove('hidden');
    }
  }

  previewHumanVoice() {
    const testWord = 'hello';
    chrome.runtime.sendMessage(
      { type: 'GET_AUDIO_URL', word: testWord, source: this.ttsConfig.humanSource },
      (response) => {
        if (response?.success && response.audioUrl) {
          const audio = new Audio(response.audioUrl);
          audio.play().catch(() => {
            alert(getMessage('human_audio_play_failed'));
          });
        } else {
          alert(getMessage('human_audio_fetch_failed'));
        }
      }
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  new PopupController();
});
