"use client";

export function HomeSection() {
  return (
    <section className="flex min-h-[100svh] flex-col justify-between px-8 py-10 md:px-16">
      <p className="font-display text-5xl tracking-tight text-foreground md:text-7xl">
        Argus
      </p>

      <div className="max-w-xl space-y-8">
        <h1 className="font-display text-3xl leading-tight tracking-tight md:text-5xl">
          Map a live debate as it happens.
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          Two speakers talk. Claims appear on the board — colored by how they
          stand in the argument.
        </p>
        <a
          href="#debate"
          className="inline-block border border-line bg-foreground px-6 py-3 text-sm font-medium text-background"
        >
          Start debating
        </a>
      </div>
    </section>
  );
}
