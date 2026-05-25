(function () {
  'use strict';

  // --- DOM refs ---
  const hoursInput = document.getElementById('hours');
  const fetchBtn = document.getElementById('fetchBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusEl = document.getElementById('status');
  const loadingEl = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');
  const previewEl = document.getElementById('preview');
  const downloadSection = document.getElementById('downloadSection');
  const emptyState = document.getElementById('emptyState');

  let newsData = [];

  // --- helpers ---
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function setLoading(isLoading, text) {
    if (text) loadingText.textContent = text;
    loadingEl.classList.toggle('hidden', !isLoading);
  }

  function showPreview(show) {
    previewEl.classList.toggle('hidden', !show);
    downloadSection.classList.toggle('hidden', !show);
    emptyState.classList.toggle('hidden', show);
  }

  async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // --- MD5 (for Baidu Translate API signing) ---
  function md5(string) {
    function md5_RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
    function md5_AddUnsigned(lX, lY) {
      var lX4, lY4, lX8, lY8, lResult;
      lX8 = (lX & 0x80000000); lY8 = (lY & 0x80000000);
      lX4 = (lX & 0x40000000); lY4 = (lY & 0x40000000);
      lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      if (lX4 | lY4) { if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8); else return (lResult ^ 0x40000000 ^ lX8 ^ lY8); }
      else return (lResult ^ lX8 ^ lY8);
    }
    function md5_F(x,y,z) { return (x & y) | ((~x) & z); }
    function md5_G(x,y,z) { return (x & z) | (y & (~z)); }
    function md5_H(x,y,z) { return (x ^ y ^ z); }
    function md5_I(x,y,z) { return (y ^ (x | (~z))); }
    function md5_FF(a,b,c,d,x,s,ac) { a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_F(b,c,d), x), ac)); return md5_AddUnsigned(md5_RotateLeft(a, s), b); }
    function md5_GG(a,b,c,d,x,s,ac) { a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_G(b,c,d), x), ac)); return md5_AddUnsigned(md5_RotateLeft(a, s), b); }
    function md5_HH(a,b,c,d,x,s,ac) { a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_H(b,c,d), x), ac)); return md5_AddUnsigned(md5_RotateLeft(a, s), b); }
    function md5_II(a,b,c,d,x,s,ac) { a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_I(b,c,d), x), ac)); return md5_AddUnsigned(md5_RotateLeft(a, s), b); }
    function md5_ConvertToWordArray(string) {
      var lWordCount, lMessageLength = string.length, lNumberOfWords_temp1 = lMessageLength + 8;
      var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64 + 1;
      var lTotalWords = lNumberOfWords_temp2 * 16, lWords = Array(lTotalWords - 1);
      var lWordPosition = 0, lBytePosition = 0, lByteCount = 0;
      while (lByteCount < lMessageLength) { lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8; lWords[lWordCount] = (lWords[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition)); lByteCount++; }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8;
      lWords[lWordCount] = lWords[lWordCount] | (0x80 << lBytePosition);
      lWords[lTotalWords - 2] = lMessageLength << 3; lWords[lTotalWords - 1] = lMessageLength >>> 29;
      return lWords;
    }
    function md5_WordToHex(lValue) { var WordToHexValue = "", lByte, lCount; for (lCount = 0; lCount <= 3; lCount++) { lByte = (lValue >>> (lCount * 8)) & 255; WordToHexValue += ("0" + lByte.toString(16)).slice(-2); } return WordToHexValue; }
    function md5_Utf8Encode(string) {
      string = string.replace(/\r\n/g, "\n"); var utftext = "";
      for (var n = 0; n < string.length; n++) { var c = string.charCodeAt(n); if (c < 128) utftext += String.fromCharCode(c); else if ((c > 127) && (c < 2048)) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128); } else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128); } }
      return utftext;
    }
    var x = [], k, AA, BB, CC, DD, a, b, c, d, S11=7,S12=12,S13=17,S14=22,S21=5,S22=9,S23=14,S24=20,S31=4,S32=11,S33=16,S34=23,S41=6,S42=10,S43=15,S44=21;
    string = md5_Utf8Encode(string); x = md5_ConvertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
      AA=a;BB=b;CC=c;DD=d;
      a=md5_FF(a,b,c,d,x[k+0],S11,0xD76AA478);d=md5_FF(d,a,b,c,x[k+1],S12,0xE8C7B756);c=md5_FF(c,d,a,b,x[k+2],S13,0x242070DB);b=md5_FF(b,c,d,a,x[k+3],S14,0xC1BDCEEE);
      a=md5_FF(a,b,c,d,x[k+4],S11,0xF57C0FAF);d=md5_FF(d,a,b,c,x[k+5],S12,0x4787C62A);c=md5_FF(c,d,a,b,x[k+6],S13,0xA8304613);b=md5_FF(b,c,d,a,x[k+7],S14,0xFD469501);
      a=md5_FF(a,b,c,d,x[k+8],S11,0x698098D8);d=md5_FF(d,a,b,c,x[k+9],S12,0x8B44F7AF);c=md5_FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);b=md5_FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
      a=md5_FF(a,b,c,d,x[k+12],S11,0x6B901122);d=md5_FF(d,a,b,c,x[k+13],S12,0xFD987193);c=md5_FF(c,d,a,b,x[k+14],S13,0xA679438E);b=md5_FF(b,c,d,a,x[k+15],S14,0x49B40821);
      a=md5_GG(a,b,c,d,x[k+1],S21,0xF61E2562);d=md5_GG(d,a,b,c,x[k+6],S22,0xC040B340);c=md5_GG(c,d,a,b,x[k+11],S23,0x265E5A51);b=md5_GG(b,c,d,a,x[k+0],S24,0xE9B6C7AA);
      a=md5_GG(a,b,c,d,x[k+5],S21,0xD62F105D);d=md5_GG(d,a,b,c,x[k+10],S22,0x2441453);c=md5_GG(c,d,a,b,x[k+15],S23,0xD8A1E681);b=md5_GG(b,c,d,a,x[k+4],S24,0xE7D3FBC8);
      a=md5_GG(a,b,c,d,x[k+9],S21,0x21E1CDE6);d=md5_GG(d,a,b,c,x[k+14],S22,0xC33707D6);c=md5_GG(c,d,a,b,x[k+3],S23,0xF4D50D87);b=md5_GG(b,c,d,a,x[k+8],S24,0x455A14ED);
      a=md5_GG(a,b,c,d,x[k+13],S21,0xA9E3E905);d=md5_GG(d,a,b,c,x[k+2],S22,0xFCEFA3F8);c=md5_GG(c,d,a,b,x[k+7],S23,0x676F02D9);b=md5_GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
      a=md5_HH(a,b,c,d,x[k+5],S31,0xFFFA3942);d=md5_HH(d,a,b,c,x[k+8],S32,0x8771F681);c=md5_HH(c,d,a,b,x[k+11],S33,0x6D9D6122);b=md5_HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
      a=md5_HH(a,b,c,d,x[k+1],S31,0xA4BEEA44);d=md5_HH(d,a,b,c,x[k+4],S32,0x4BDECFA9);c=md5_HH(c,d,a,b,x[k+7],S33,0xF6BB4B60);b=md5_HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
      a=md5_HH(a,b,c,d,x[k+13],S31,0x289B7EC6);d=md5_HH(d,a,b,c,x[k+0],S32,0xEAA127FA);c=md5_HH(c,d,a,b,x[k+3],S33,0xD4EF3085);b=md5_HH(b,c,d,a,x[k+6],S34,0x4881D05);
      a=md5_HH(a,b,c,d,x[k+9],S31,0xD9D4D039);d=md5_HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);c=md5_HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);b=md5_HH(b,c,d,a,x[k+2],S34,0xC4AC5665);
      a=md5_II(a,b,c,d,x[k+0],S41,0xF4292244);d=md5_II(d,a,b,c,x[k+7],S42,0x432AFF97);c=md5_II(c,d,a,b,x[k+14],S43,0xAB9423A7);b=md5_II(b,c,d,a,x[k+5],S44,0xFC93A039);
      a=md5_II(a,b,c,d,x[k+12],S41,0x655B59C3);d=md5_II(d,a,b,c,x[k+3],S42,0x8F0CCC92);c=md5_II(c,d,a,b,x[k+10],S43,0xFFEFF47D);b=md5_II(b,c,d,a,x[k+1],S44,0x85845DD1);
      a=md5_II(a,b,c,d,x[k+8],S41,0x6FA87E4F);d=md5_II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);c=md5_II(c,d,a,b,x[k+6],S43,0xA3014314);b=md5_II(b,c,d,a,x[k+13],S44,0x4E0811A1);
      a=md5_II(a,b,c,d,x[k+4],S41,0xF7537E82);d=md5_II(d,a,b,c,x[k+11],S42,0xBD3AF235);c=md5_II(c,d,a,b,x[k+2],S43,0x2AD7D2BB);b=md5_II(b,c,d,a,x[k+9],S44,0xEB86D391);
      a=md5_AddUnsigned(a,AA);b=md5_AddUnsigned(b,BB);c=md5_AddUnsigned(c,CC);d=md5_AddUnsigned(d,DD);
    }
    return (md5_WordToHex(a)+md5_WordToHex(b)+md5_WordToHex(c)+md5_WordToHex(d)).toLowerCase();
  }

  // --- Translation config management ---
  async function loadTransConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get(['transProvider', 'baiduAppId', 'baiduSecret'], result => {
        resolve({
          provider: result.transProvider || 'google',
          baiduAppId: result.baiduAppId || '',
          baiduSecret: result.baiduSecret || '',
        });
      });
    });
  }

  async function saveTransConfig(provider, appId, secret) {
    return new Promise(resolve => {
      chrome.storage.local.set({ transProvider: provider, baiduAppId: appId, baiduSecret: secret }, resolve);
    });
  }

  // --- CNBC RSS feed URLs ---
  const RSS_FEEDS = [
    'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362',
    'https://www.cnbc.com/id/100727362/device/rss/rss.html',
    'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
  ];

  const CNBC_WORLD_URL = 'https://www.cnbc.com/world/?region=world';

  // --- Step 1: Fetch article list from CNBC ---
  async function fetchArticleList() {
    let lastError = null;

    // Try RSS feeds first
    for (const feedUrl of RSS_FEEDS) {
      try {
        const resp = await fetch(feedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) continue;
        const xml = await resp.text();
        const articles = parseRssXml(xml);
        if (articles.length > 0) return articles;
      } catch (e) {
        lastError = e;
      }
    }

    // Fallback: scrape HTML page
    try {
      const resp = await fetch(CNBC_WORLD_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      const articles = parseHtmlArticles(html);
      if (articles.length > 0) return articles;
    } catch (e) {
      lastError = e;
    }

    throw new Error('无法获取新闻列表: ' + (lastError ? lastError.message : '所有数据源均失败'));
  }

  // --- Parse RSS XML ---
  function parseRssXml(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = doc.querySelectorAll('item');
    const articles = [];

    items.forEach(item => {
      const title = item.querySelector('title')?.textContent?.trim();
      const link = item.querySelector('link')?.textContent?.trim();
      const pubDateStr = item.querySelector('pubDate')?.textContent?.trim();
      const desc = item.querySelector('description')?.textContent?.trim() || '';
      const summary = desc.replace(/<[^>]*>/g, '').trim();

      if (!title || !link || !pubDateStr) return;

      const pubDate = new Date(pubDateStr);
      if (isNaN(pubDate.getTime())) return;

      // Normalize link
      const fullLink = link.startsWith('http') ? link : 'https://www.cnbc.com' + link;

      articles.push({
        title,
        link: fullLink,
        pubDate,
        summary,
        fullContent: '',
        titleCn: '',
        summaryCn: '',
        contentCn: '',
        source: 'rss',
      });
    });

    return articles;
  }

  // --- Parse HTML page (fallback) ---
  function parseHtmlArticles(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const articles = [];

    // Try to find article cards
    const articleSelectors = [
      'article',
      '[class*="RiverCard"]',
      '[class*="Card"]',
      '[class*="card"]',
      '[class*="story"]',
      'div[class*="Teaser"]',
    ];

    let elements = [];
    for (const sel of articleSelectors) {
      const found = doc.querySelectorAll(sel);
      if (found.length > 0) {
        elements = found;
        break;
      }
    }

    // Also try script JSONLD
    const jsonldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const jsonldArticles = parseJsonLd(jsonldScripts);
    articles.push(...jsonldArticles);

    // Parse from DOM elements
    elements.forEach(el => {
      const linkEl = el.tagName === 'A' ? el : el.querySelector('a[href*="/20"]');
      if (!linkEl) return;

      const href = linkEl.getAttribute('href');
      if (!href) return;
      if (!href.includes('/20') && !href.includes('/20')) return;

      const title = linkEl.textContent?.trim() || '';
      if (!title || title.length < 10) return;

      const fullLink = href.startsWith('http') ? href : 'https://www.cnbc.com' + href;
      if (articles.some(a => a.link === fullLink)) return;

      const timeEl = el.querySelector('time, [class*="time"], [class*="date"]');
      let pubDate = new Date();
      if (timeEl) {
        const dt = timeEl.getAttribute('datetime') || timeEl.textContent?.trim();
        const parsed = new Date(dt);
        if (!isNaN(parsed.getTime())) pubDate = parsed;
      }

      const summaryEl = el.querySelector('p, [class*="summary"], [class*="description"]');
      const summary = summaryEl ? summaryEl.textContent?.trim() || '' : '';

      articles.push({
        title,
        link: fullLink,
        pubDate,
        summary,
        fullContent: '',
        titleCn: '',
        summaryCn: '',
        contentCn: '',
        source: 'html',
      });
    });

    // Deduplicate by link
    const seen = new Set();
    return articles.filter(a => {
      if (seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    });
  }

  // --- Parse JSON-LD structured data ---
  function parseJsonLd(scripts) {
    const articles = [];
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'NewsArticle' || item['@type'] === 'Article') {
            const title = item.headline?.trim();
            const link = item.url?.trim();
            const pubDate = new Date(item.datePublished);
            const summary = item.description?.trim() || '';

            if (title && link && !isNaN(pubDate.getTime())) {
              const fullLink = link.startsWith('http') ? link : 'https://www.cnbc.com' + link;
              articles.push({
                title,
                link: fullLink,
                pubDate,
                summary,
                fullContent: '',
                titleCn: '',
                summaryCn: '',
                contentCn: '',
                source: 'jsonld',
              });
            }
          }
        }
      } catch (e) {
        // skip invalid JSON
      }
    }
    return articles;
  }

  // --- Step 2: Filter by time window ---
  function filterByTime(articles, hours) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return articles.filter(a => a.pubDate.getTime() >= cutoff);
  }

  // --- Step 3: Fetch full article content ---
  async function fetchArticleContent(url) {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();
    return extractArticleBody(html);
  }

  function extractArticleBody(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try various content selectors
    const contentSelectors = [
      '.ArticleBody',
      '.article-body',
      '.group-content',
      '.page-content',
      '[class*="article-body"]',
      '[class*="ArticleBody"]',
      '.featured-content',
      '.story-content',
      'article .content',
      '[class*="article-content"]',
    ];

    for (const sel of contentSelectors) {
      const el = doc.querySelector(sel);
      if (el) {
        const paragraphs = el.querySelectorAll('p');
        const texts = [];
        paragraphs.forEach(p => {
          const t = p.textContent.trim();
          if (t.length > 20) texts.push(t);
        });
        if (texts.length > 0) return texts.join('\n\n');
      }
    }

    // Fallback: get long paragraphs from the page
    const allParagraphs = doc.querySelectorAll('p');
    const longParagraphs = [];
    allParagraphs.forEach(p => {
      const t = p.textContent.trim();
      if (t.length > 40) longParagraphs.push(t);
    });

    if (longParagraphs.length > 0) {
      return longParagraphs.join('\n\n');
    }

    return '';
  }

  // --- Step 4: Translate text (EN -> ZH-CN) ---
  async function translate(text) {
    if (!text || text.trim().length === 0) return '';
    const maxChunk = 800;
    const chunks = [];
    for (let i = 0; i < text.length; i += maxChunk) {
      chunks.push(text.slice(i, i + maxChunk));
    }

    const results = [];
    for (const chunk of chunks) {
      // Baidu free tier QPS = 1, so must wait 1s between requests
      const result = await translateWithRetry(chunk);
      results.push(result);
      await sleep(1100);
    }
    return results.join('');
  }

  async function translateWithRetry(text, maxRetries) {
    maxRetries = maxRetries || 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await translateChunk(text);
      } catch (e) {
        // 所有错误都重试，最大重试次数后放弃（返回原文）
        if (attempt < maxRetries - 1) {
          console.warn(`翻译重试 #${attempt + 1}:`, e.message);
          await sleep(1500 * Math.pow(2, attempt)); // 1.5s, 3s, 6s, 12s...
          continue;
        }
        // Last resort - return original text
        console.error('翻译最终失败:', e.message);
        return text;
      }
    }
    return text;
  }

  async function translateChunk(text) {
    const { provider, baiduAppId, baiduSecret } = await loadTransConfig();

    if (provider === 'baidu') {
      // --- 百度翻译（需 API 密钥，国内可用） ---
      if (!baiduAppId || !baiduSecret) throw new Error('百度翻译未配置');
      const salt = Date.now() + Math.random();
      const sign = md5(baiduAppId + text + salt + baiduSecret);
      const url = `https://api.fanyi.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=en&to=zh&appid=${baiduAppId}&salt=${salt}&sign=${sign}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (data.error_code) throw new Error('百度翻译错误 [' + data.error_code + ']');
      return data.trans_result.map(item => item.dst).join('');
    }

    // --- Google 翻译（默认，需VPN，无需配置） ---
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error('Google Translate error: ' + resp.status);
    const data = await resp.json();
    return data[0].map(item => item[0]).join('');
  }

  // --- Translation: sequential (avoid QPS limit) ---
  async function translateAll(articles) {
    const translated = [];
    for (let i = 0; i < articles.length; i++) {
      const a = articles[i];
      setLoading(true, `正在翻译第 ${i + 1}/${articles.length} 条 (标题)...`);
      const titleCn = await translate(a.title);

      setLoading(true, `正在翻译第 ${i + 1}/${articles.length} 条 (摘要)...`);
      const summaryCn = await translate(a.summary || '');

      setLoading(true, `正在翻译第 ${i + 1}/${articles.length} 条 (正文)...`);
      const contentCn = await translate(a.fullContent || '');

      translated.push({ ...a, titleCn, summaryCn, contentCn });
    }
    return translated;
  }

  // --- Preview rendering (EN | CN side-by-side) ---
  function renderPreview(articles) {
    previewEl.innerHTML = '';
    articles.forEach(a => {
      const div = document.createElement('div');
      div.className = 'preview-item';

      const pubDateStr = a.pubDate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const origTitle = a.title || '';
      const cnTitle = a.titleCn || '';

      div.innerHTML = `
        <div class="article-title">${escapeHtml(cnTitle || origTitle)}</div>
        ${origTitle && cnTitle ? `<div class="article-title-en">${escapeHtml(origTitle)}</div>` : ''}
        <div class="article-meta">${pubDateStr} &nbsp;|&nbsp; <a href="${escapeHtml(a.link)}" target="_blank">原文链接</a></div>
        <div class="compare-grid">
          <div class="compare-col en-col">
            <div class="compare-label">English</div>
            <div class="compare-summary">${escapeHtml(a.summary || '(无摘要)')}</div>
            <div class="compare-content">${escapeHtml(a.fullContent || '(无正文)').replace(/\n/g, '<br>')}</div>
          </div>
          <div class="compare-col cn-col">
            <div class="compare-label">中文</div>
            <div class="compare-summary">${escapeHtml(a.summaryCn || '(翻译中...)')}</div>
            <div class="compare-content">${escapeHtml(a.contentCn || a.fullContent || '(翻译中...)').replace(/\n/g, '<br>')}</div>
          </div>
        </div>
      `;
      previewEl.appendChild(div);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // --- Word document generation (EN | CN side-by-side) ---
  function generateWordHTML(articles) {
    const now = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const hours = hoursInput.value || '24';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    let bodyHtml = '';
    articles.forEach((a, i) => {
      const pubDateStr = a.pubDate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const origTitle = a.title || '';
      const cnTitle = a.titleCn || '';

      bodyHtml += `
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <h2 style="color: #1a1a2e; font-size: 18pt; margin-bottom: 2px; line-height: 1.4;">
          ${escapeHtml(cnTitle || origTitle)}
        </h2>
        ${origTitle && cnTitle ? `<p style="color: #666; font-size: 10pt; margin-bottom: 6px; font-style: italic;">${escapeHtml(origTitle)}</p>` : ''}
        <p style="color: #888; font-size: 10pt; margin-bottom: 14px;">
          发布时间: ${pubDateStr} &nbsp;|&nbsp;
          <a href="${escapeHtml(a.link)}" style="color: #2563eb;">原文链接</a>
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 11pt; color: #1a1a2e; margin: 0 0 8px 0; border-bottom: 2px solid #2563eb; padding-bottom: 4px;">English</h3>
              <div style="font-size: 10pt; color: #333; line-height: 1.6;">
                <p style="margin: 0 0 8px 0;"><strong>摘要:</strong><br>${escapeHtml(a.summary || '(无摘要)')}</p>
                <p style="margin: 0;"><strong>正文:</strong><br>${escapeHtml(a.fullContent || '(无正文)').replace(/\n/g, '<br>')}</p>
              </div>
            </td>
            <td style="width: 50%; vertical-align: top; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h3 style="font-size: 11pt; color: #166534; margin: 0 0 8px 0; border-bottom: 2px solid #22c55e; padding-bottom: 4px;">中文</h3>
              <div style="font-size: 10pt; color: #333; line-height: 1.6;">
                <p style="margin: 0 0 8px 0;"><strong>摘要:</strong><br>${escapeHtml(a.summaryCn || '(翻译中...)')}</p>
                <p style="margin: 0;"><strong>正文:</strong><br>${escapeHtml(a.contentCn || a.fullContent || '(翻译中...)').replace(/\n/g, '<br>')}</p>
              </div>
            </td>
          </tr>
        </table>
      </div>`;
    });

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: 'Microsoft YaHei', 'PingFang SC', 'SimSun', Arial, sans-serif; padding: 40px; }
  h1 { color: #1a1a2e; font-size: 24pt; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
  .meta { color: #999; font-size: 10pt; margin-bottom: 30px; }
  a { color: #2563eb; text-decoration: none; }
</style>
</head>
<body>
  <h1>CNBC 热点新闻报告</h1>
  <p class="meta">生成时间: ${now} | 时间范围: 过去 ${hours} 小时 | 共 ${articles.length} 条新闻</p>
  <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 30px;">
  ${bodyHtml}
</body>
</html>`;
  }

  function downloadWordDocument(articles) {
    const html = generateWordHTML(articles);
    // BOM helps Word recognize UTF-8 encoding
    const blob = new Blob(['﻿' + html], {
      type: 'application/msword;charset=utf-8',
    });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CNBC_News_${dateStr}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Main workflow ---
  async function startFetching() {
    const hours = parseInt(hoursInput.value) || 24;

    if (hours < 1 || hours > 168) {
      setStatus('请输入 1-168 之间的小时数', 'error');
      return;
    }

    setStatus(`正在获取过去 ${hours} 小时的 CNBC 新闻...`);
    setLoading(true, '正在获取新闻列表...');
    fetchBtn.disabled = true;
    showPreview(false);
    newsData = [];

    try {
      // Step 1 & 2: Fetch and filter
      const allArticles = await fetchArticleList();
      const recentArticles = filterByTime(allArticles, hours);

      if (recentArticles.length === 0) {
        setStatus(`过去 ${hours} 小时内没有找到新闻，请扩大时间范围`, 'error');
        setLoading(false);
        fetchBtn.disabled = false;
        return;
      }

      // 全部处理，不限量
      const processArticles = recentArticles;
      setStatus(`找到 ${processArticles.length} 条新闻，正在处理...`);

      // Step 3: Fetch full content (with concurrency: 3 at a time)
      setLoading(true, '正在获取文章详细内容...');
      const contentResults = [];
      const concurrency = 3;
      for (let i = 0; i < processArticles.length; i += concurrency) {
        const batch = processArticles.slice(i, i + concurrency);
        setLoading(true, `正在获取详细内容 (${Math.min(i + concurrency, processArticles.length)}/${processArticles.length})...`);
        const batchResults = await Promise.allSettled(
          batch.map(a => fetchArticleContent(a.link).catch(() => ''))
        );
        batchResults.forEach((r, idx) => {
          processArticles[i + idx].fullContent = r.status === 'fulfilled' ? r.value : '';
        });
      }

      // Step 4: Translate
      const translated = await translateAll(processArticles);
      newsData = translated;

      // Step 5: Show preview
      renderPreview(newsData);
      showPreview(true);
      setStatus(`成功获取 ${newsData.length} 条新闻并完成翻译`, 'success');
    } catch (e) {
      setStatus('出错: ' + e.message, 'error');
    } finally {
      setLoading(false);
      fetchBtn.disabled = false;
    }
  }

  // --- Download handler ---
  function handleDownload() {
    if (newsData.length === 0) {
      setStatus('没有可下载的新闻，请先获取', 'error');
      return;
    }
    downloadWordDocument(newsData);
    setStatus('文档下载完成', 'success');
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', async function () {
    // Default hours
    hoursInput.value = 24;

    // Load saved config
    const config = await loadTransConfig();
    document.getElementById('transProvider').value = config.provider;
    document.getElementById('baiduAppId').value = config.baiduAppId;
    document.getElementById('baiduSecret').value = config.baiduSecret;
    toggleBaiduConfig(config.provider === 'baidu');

    fetchBtn.addEventListener('click', startFetching);
    downloadBtn.addEventListener('click', handleDownload);
    document.getElementById('closeBtn').addEventListener('click', () => window.close());

    // Settings toggle
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    settingsToggle.addEventListener('click', () => {
      settingsPanel.classList.toggle('hidden');
    });

    // Provider switch toggle
    document.getElementById('transProvider').addEventListener('change', function () {
      toggleBaiduConfig(this.value === 'baidu');
    });

    // Save settings
    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
      const provider = document.getElementById('transProvider').value;
      const appId = document.getElementById('baiduAppId').value.trim();
      const secret = document.getElementById('baiduSecret').value.trim();
      if (provider === 'baidu' && (!appId || !secret)) {
        document.getElementById('settingsStatus').textContent = '请填写完整的 APP ID 和密钥';
        document.getElementById('settingsStatus').style.color = '#dc2626';
        return;
      }
      await saveTransConfig(provider, appId, secret);
      const status = document.getElementById('settingsStatus');
      status.textContent = '✓ 保存成功';
      status.style.color = '#059669';
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  });

  function toggleBaiduConfig(show) {
    document.getElementById('baiduConfig').style.display = show ? 'block' : 'none';
  }

})();
