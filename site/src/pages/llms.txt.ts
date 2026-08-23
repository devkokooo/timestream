import type { APIRoute } from "astro";
import { listBlogPosts } from "../lib/blog";
import {
  DISCORD_HREF,
  GITHUB_REPO,
  LICENSE_HREF,
  RELEASE_HREF,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SUPPORT_HREF,
} from "../lib/site";

/** Curated Markdown map for AI agents (https://llmstxt.org). */
export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? url).origin.replace(/\/$/, "");
  const abs = (path: string) => `${origin}${path === "/" ? "/" : path.endsWith("/") ? path : `${path}/`}`;

  const posts = listBlogPosts()
    .map(
      (post) =>
        `- [${post.title}](${abs(`/blog/${post.slug}/`)}): ${post.description}`,
    )
    .join("\n");

  const body = `# ${SITE_TITLE}

> ${SITE_DESCRIPTION}

Timestream is a local-first TVA-styled Git client with GitHub integration.
The commit graph is a TVA Chronomonitor: a Sacred Timeline with variant branches as spurs.
Open source under AGPL-3.0.
Primary forge integration is GitHub (clone, fetch, ff-only pull, push, PRs, issues, releases).

## Pages

- [Home](${abs("/")}): Product overview, interactive walkthrough, manifesto, FAQ, and download
- [Dispatches](${abs("/blog/")}): Release notes and product updates

## Dispatches

${posts || `- [Dispatches index](${abs("/blog/")}): Latest product updates`}

## Optional

- [Privacy Policy](${abs("/privacy/")}): What Timestream collects and stores
- [Terms of Service](${abs("/tos/")}): Usage terms for the product and site
- [GitHub repository](${GITHUB_REPO}): Source code and issue tracker
- [Latest release](${RELEASE_HREF}): Current public download
- [License (AGPL-3.0)](${LICENSE_HREF}): Open-source license text
- [Support](${SUPPORT_HREF}): File bugs and feature requests
- [Discord](${DISCORD_HREF}): Community channel
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
