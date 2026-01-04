const ARPABET_TO_IPA = {
    'AA': 'ɑː', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔː', 'AW': 'aʊ',
    'AY': 'aɪ', 'EH': 'ɛ', 'ER': 'ɜːr', 'EY': 'eɪ', 'IH': 'ɪ',
    'IY': 'iː', 'OW': 'oʊ', 'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'uː',
    'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f',
    'G': 'g', 'HH': 'h', 'JH': 'dʒ', 'K': 'k', 'L': 'l',
    'M': 'm', 'N': 'n', 'NG': 'ŋ', 'P': 'p', 'R': 'r',
    'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v',
    'W': 'w', 'Y': 'j', 'Z': 'z', 'ZH': 'ʒ',
};

export class DictionaryService {
    constructor() {
        this.cmudict = null;
        this.loading = null;
    }

    async loadDictionary() {
        if (this.cmudict) return;
        if (this.loading) return this.loading;

        this.loading = (async () => {
            try {
                const url = chrome.runtime.getURL('data/cmudict.json');
                const response = await fetch(url);
                this.cmudict = await response.json();
                console.log(`📖 CMUdict 已加载，包含 ${Object.keys(this.cmudict).length} 个单词`);
            } catch (error) {
                console.error('加载词典失败:', error);
                this.cmudict = {};
            }
        })();

        return this.loading;
    }

    getArpabet(word) {
        if (!this.cmudict) return null;
        return this.cmudict[word.toLowerCase()] || null;
    }

    arpabetToIPA(arpabet) {
        if (!arpabet) return null;
        const phonemes = arpabet.split(' ');
        const ipaSymbols = phonemes.map(p => {
            const base = p.replace(/[012]/g, '');
            return ARPABET_TO_IPA[base] || base.toLowerCase();
        });
        return `/${ipaSymbols.join('')}/`;
    }

    getIPA(word) {
        const arpabet = this.getArpabet(word);
        if (arpabet) {
            return this.arpabetToIPA(arpabet);
        }
        return null;
    }

    hasWord(word) {
        if (!this.cmudict) return false;
        return !!this.cmudict[word.toLowerCase()];
    }
}
