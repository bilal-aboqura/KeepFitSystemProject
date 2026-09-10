import { cn } from "@/lib/utils";

type LegalSection = {
  title: string;
  body: string[];
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  note,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  note: string;
}) {
  return (
    <div className="bg-[linear-gradient(180deg,rgba(225,6,0,0.06),transparent_22%)]">
      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="glass-elevated overflow-hidden">
          <div className="border-b border-border bg-[radial-gradient(circle_at_top_left,rgba(225,6,0,0.22),transparent_34%),linear-gradient(135deg,rgba(17,17,17,0.98),rgba(46,46,46,0.95))] px-6 py-8 text-white sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78 sm:text-base">
              {intro}
            </p>
          </div>

          <div className="grid gap-4 bg-surface p-5 sm:p-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(260px,0.22fr)]">
            <div className="space-y-4">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  className="glass rounded-[20px] p-5 sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <h2 className="text-lg font-semibold text-fg">{section.title}</h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {section.body.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-sm leading-7 text-fg-muted sm:text-[15px]"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <aside
              className={cn(
                "rounded-[24px] border border-border bg-[linear-gradient(180deg,rgba(225,6,0,0.08),rgba(255,255,255,0.96))] p-5 sm:p-6",
                "lg:sticky lg:top-24 lg:h-fit",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                Xeemo
              </p>
              <h2 className="mt-3 text-lg font-semibold text-fg">{note}</h2>
              <div className="mt-5 space-y-3 text-sm text-fg-muted">
                <div className="rounded-2xl border border-border bg-white/80 p-4">
                  <p className="font-medium text-fg">Phone</p>
                  <p dir="ltr" className="mt-1">
                    +20 115 030 1033
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-white/80 p-4">
                  <p className="font-medium text-fg">Email</p>
                  <p className="mt-1 break-all">mohamed.xeemo@gmail.com</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/80 p-4">
                  <p className="font-medium text-fg">Address</p>
                  <p className="mt-1">Egypt, Gharbia, Tanta</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
