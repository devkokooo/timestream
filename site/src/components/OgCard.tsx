import { RELEASE_LABEL, SITE_DESCRIPTION } from "../lib/site";
import { OgReviewBackdrop, type OgDiffHighlight } from "./OgReviewBackdrop";

/** 1200×630 share card: review desk as the field, title over the lower third. */
export function OgCard({ highlight }: { highlight: OgDiffHighlight }) {
  return (
    <div
      data-og-card
      className="relative h-[630px] w-[1200px] overflow-hidden bg-tva-concrete text-tva-paper"
    >
      <div
        className="absolute inset-0 flex min-h-0 origin-[40%_0%] scale-[1.14] flex-col"
        aria-hidden="true"
      >
        <OgReviewBackdrop highlight={highlight} />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(22,19,16,0.12)_0%,transparent_20%,rgba(22,19,16,0.28)_46%,rgba(22,19,16,0.92)_72%,#161310_88%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-10 px-12 pb-11">
        <div className="min-w-0">
          <p className="eyebrow mb-4">Chronomonitoring</p>
          <div className="flex items-center gap-4">
            <img src="/timestream-logo.svg" alt="" width="56" height="56" className="size-14 shrink-0" />
            <h1 className="m-0 font-display text-[4.35rem] leading-none font-semibold tracking-[0.12em]">
              TIMESTREAM
            </h1>
          </div>
          <p className="mt-4 max-w-[44rem] text-[1.05rem] leading-snug text-tva-paper-dim">{SITE_DESCRIPTION}</p>
        </div>
        <span className="stamp stamp-gold mb-2 shrink-0">{RELEASE_LABEL}</span>
      </div>
    </div>
  );
}
