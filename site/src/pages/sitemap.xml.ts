import type { APIRoute } from "astro";
import { listBlogPosts } from "../lib/blog";

type SitemapPage = {
  path: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
};

const today = new Date().toISOString().slice(0, 10);

// Index public pages only
const pages: SitemapPage[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  ...listBlogPosts().map((post) => ({
    path: `/blog/${post.slug}`,
    changefreq: "weekly" as const,
    priority: "0.7",
    lastmod: post.updated,
  })),
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/tos", changefreq: "yearly", priority: "0.3" },
];

export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? url).origin.replace(/\/$/, "");

  const urls = pages
    .map(({ path, changefreq, priority, lastmod = today }) => {
      const loc = path === "/" ? `${origin}/` : `${origin}${path}`;
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
