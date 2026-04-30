/**
 * Генерирует public/sitemap.xml и public/robots.txt.
 * Базовый URL: REACT_APP_SITE_URL (например https://portal.college.edu) или http://localhost:3000.
 */
const fs = require('fs');
const path = require('path');

const rawBase = process.env.REACT_APP_SITE_URL || 'http://localhost:3000';
const base = rawBase.replace(/\/+$/, '');

const routes = [
  /**
   * Публичные и основные маршруты SPA (см. src/App.js).
   * Закрытые страницы в sitemap допустимы: при обходе без сессии будет редирект.
   */
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/welcome', changefreq: 'weekly', priority: '0.9' },
  { path: '/login', changefreq: 'monthly', priority: '0.8' },
  { path: '/student', changefreq: 'weekly', priority: '0.6' },
  { path: '/teacher', changefreq: 'weekly', priority: '0.6' },
  { path: '/admin', changefreq: 'weekly', priority: '0.5' },
  { path: '/profile', changefreq: 'monthly', priority: '0.5' },
  { path: '/notifications', changefreq: 'weekly', priority: '0.4' },
  { path: '/messages', changefreq: 'weekly', priority: '0.5' },
];

const urls = routes.map((r) => {
  const loc = r.path === '/' ? `${base}/` : `${base}${r.path}`;
  const lastmod = new Date().toISOString().split('T')[0];
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml, 'utf8');

const robots = `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;

fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf8');

console.log(`Sitemap: ${base}/sitemap.xml`);
