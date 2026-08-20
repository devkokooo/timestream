import type { APIRoute } from "astro";

/** Allow all crawlers; point them at the public sitemap. */
export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? url).origin.replace(/\/$/, "");

  const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
