import { useEffect, useState } from "react";
import { githubCreateRelease, githubListReleases, githubUpdateRelease } from "@/github/releases/api";
import { btn, btnPrimary, emptyText, fieldInput, fieldLabel, stamp } from "@/ui/ui";
import type { CreateRelease, ReleaseSummary } from "@/github/releases/types";
import { dispatchMessage } from "@/github/dispatch";
import { TvaScrollArea } from "@/ui/TvaScrollArea";
import { HqDispatch, NeedClearance } from "@/github/hqChrome";
import type { HqModeProps } from "@/github/hqTypes";

export function CanonPanel(props: HqModeProps) {
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!props.signedIn || !props.owner || !props.repoName) return;
    setError(null);
    setReleases(await githubListReleases(props.owner, props.repoName));
  }

  useEffect(() => {
    void reload().catch((err) => setError(dispatchMessage(err)));
  }, [props.owner, props.repoName]);

  const tags = (props.timeline?.nodes ?? []).flatMap((n) => n.refs.filter((r) => r.kind === "tag").map((r) => r.name));

  return (
    <TvaScrollArea className="min-h-0 flex-1" axis="y" fill viewportClassName="p-3">
      <p className={`${fieldLabel} mb-2`}>
        File seals on the chronomonitor (right-click a nexus), then declare them canon here.
      </p>
      {!props.signedIn ? <NeedClearance /> : null}
      {props.signedIn && props.owner ? (
        <>
          <HqDispatch
            error={error}
            onRetry={() => void reload().catch((err) => setError(dispatchMessage(err)))}
            onSignIn={props.onSignIn}
          />
          <div className="mb-3 border border-tva-gold/16 p-2">
            <p className="m-0 mb-2 text-[10px] uppercase tracking-[0.12em] text-tva-gold">Declare canon · Create release</p>
            <select className={`${fieldInput} mb-1`} value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Existing tag…</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input className={`${fieldInput} mb-1`} placeholder="Release name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className={`${fieldInput} mb-1`} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
            <label className="mr-3 inline-flex items-center gap-2.5 text-[11px] text-tva-muted">
              <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
              Draft
            </label>
            <label className="inline-flex items-center gap-2.5 text-[11px] text-tva-muted">
              <input type="checkbox" checked={prerelease} onChange={(e) => setPrerelease(e.target.checked)} />
              Prerelease
            </label>
            <button
              type="button"
              className={`${btnPrimary} mt-2`}
              disabled={!tag.trim()}
              onClick={async () => {
                if (!props.signedIn || !props.owner || !props.repoName) return;
                const input: CreateRelease = {
                  tagName: tag.trim(),
                  name: name || tag.trim(),
                  body,
                  draft,
                  prerelease,
                };
                try {
                  await githubCreateRelease(props.owner, props.repoName, input);
                  await reload();
                } catch (err) {
                  setError(dispatchMessage(err));
                }
              }}
            >
              Create release
            </button>
          </div>
          {releases.map((rel) => (
            <div key={rel.id} className="mb-2 border border-tva-gold/14 p-2 text-xs">
              <span className={stamp} title="GitHub Release">
                CANON
              </span>{" "}
              {rel.tagName} · {rel.name}
              {rel.draft ? " · draft" : ""}
              {rel.prerelease ? " · pre" : ""}
              <p className="m-0 mt-1 text-tva-paper-dim">{rel.body}</p>
              {rel.draft ? (
                <button
                  type="button"
                  className={`${btn} mt-1`}
                  onClick={async () => {
                    if (!props.signedIn || !props.owner || !props.repoName) return;
                    try {
                      await githubUpdateRelease(props.owner, props.repoName, rel.id, { draft: false });
                      await reload();
                    } catch (err) {
                      setError(dispatchMessage(err));
                    }
                  }}
                >
                  Publish draft
                </button>
              ) : null}
            </div>
          ))}
        </>
      ) : props.signedIn ? (
        <p className={`${emptyText} mt-2`}>No GitHub origin on this archive.</p>
      ) : null}
    </TvaScrollArea>
  );
}
