"use client";

export function HomeSection() {
  return (
    <section className="flex min-h-[100svh] flex-col justify-between px-8 py-12 md:px-16">
      <p className="font-display text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
        Argus
      </p>

      <div className="max-w-xl space-y-7">
        <h1 className="font-display text-3xl font-semibold leading-[1.15] tracking-tight text-foreground md:text-5xl">
          Map a live debate as it happens.
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          Two speakers talk. Claims appear on the board — colored by how they
          stand in the argument.
        </p>
        <a
          href="#debate"
          className="inline-flex rounded-soft bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)]"
        >
          Start debating
        </a>
      </div>
    </section>
  );
}
