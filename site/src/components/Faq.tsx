import { useState } from "react";

const ITEMS = [
  {
    q: "What is Timestream?",
    a: "A local-first Git client for the desktop. It shows your commit graph as a timeline, then lets you review diffs, commit, push over SSH, and work GitHub pull requests without leaving the desk.",
  },
  {
    q: "How is my data handled?",
    a: "Your repositories, diffs, and working tree stay on the machine you open. The app does not send git contents to Timestream's authors. If you sign in to GitHub, tokens and related secrets live in the operating system keychain, not in settings.toml. GitHub's own privacy policy applies to that sign-in and to any GitHub API requests the client makes on your behalf.",
  },
  {
    q: "Do I need to know Loki?",
    a: "No. The TVA look is the theme — orange tile, gold veining, dossiers, stamps. The product is a Git client. Sacred Timeline just means the default branch graph. But we do recommend you to watch Loki.",
  },
  {
    q: "Which platforms ship in v0.1?",
    a: "Windows (NSIS installer), macOS (DMG), and Linux (AppImage). Get v0.1 from the GitHub release.",
  },
  {
    q: "Is it open source?",
    a: "Yes. Timestream is available under the AGPL-3.0 license.",
  },
  {
    q: "Will it force-push or rewrite published history?",
    a: "No. Timestream never rewrites published history and never force-pushes. Local amend of unpublished HEAD is allowed. Pull is ff-only.",
  },
  {
    q: "GitHub App or personal access token?",
    a: "Primary sign-in is a GitHub App device flow. A classic PAT is the fallback when the client ID is not configured, or if you prefer a token. Secrets live in the OS keychain, never in settings.toml.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-t border-tva-gold/16">
      {ITEMS.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.q} className="border-b border-tva-gold/16">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-6 border-0 bg-transparent py-5 text-left"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : index)}
            >
              <span className="text-sm tracking-[0.02em] text-tva-paper md:text-base">{item.q}</span>
              <span className="mt-0.5 shrink-0 text-[0.625rem] uppercase tracking-[0.16em] text-tva-gold">
                {expanded ? "Close" : "File"}
              </span>
            </button>
            {expanded ? (
              <p className="m-0 max-w-3xl pb-5 text-sm leading-relaxed text-tva-paper-dim">{item.a}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
