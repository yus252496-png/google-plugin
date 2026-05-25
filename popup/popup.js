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
      try {
        const result = await translateChunk(chunk);
        results.push(result);
        await sleep(200); // be gentle with the API
      } catch (e) {
        // fallback: return original
        results.push(chunk);
      }
    }
    return results.join('');
  }

  async function translateChunk(text) {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encoded}`;

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error('Translation API error: ' + resp.status);
    const data = await resp.json();
    // data[0] is array of [translated, original, ...]
    return data[0].map(item => item[0]).join('');
  }

  // --- Translation with concurrency ---
  async function translateAll(articles) {
    const translated = [];
    for (let i = 0; i < articles.length; i++) {
      const a = articles[i];
      setLoading(true, `正在翻译第 ${i + 1}/${articles.length} 条...`);

      const [titleCn, summaryCn, contentCn] = await Promise.all([
        translate(a.title),
        translate(a.summary || ''),
        translate(a.fullContent || ''),
      ]);

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
  document.addEventListener('DOMContentLoaded', function () {
    // Default hours
    hoursInput.value = 24;

    fetchBtn.addEventListener('click', startFetching);
    downloadBtn.addEventListener('click', handleDownload);
    document.getElementById('closeBtn').addEventListener('click', () => window.close());
  });

})();
