/*
 * A0.1 shell only — proves the app boots (Gate A0).
 * The real desktop layout (graph area + transcript + inspector) is Task B1.2.3.
 */
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-xl space-y-4 text-center">
        <h1 className="font-mono text-4xl font-semibold tracking-tight">
          Argus
        </h1>
        <p className="text-lg text-muted">
          Live debate → structured extraction → real-time argument graph.
        </p>
        <p className="text-sm text-muted">
          Desktop <strong className="text-foreground">Chrome</strong> only —
          speech capture uses the Web Speech API and needs microphone
          permission.
        </p>
        <p className="border-t border-border pt-4 font-mono text-xs text-muted">
          Scaffold ready. Speech capture lands in B1.
        </p>
      </div>
    </main>
  );
}
