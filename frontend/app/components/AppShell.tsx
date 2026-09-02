export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-blue-50 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 dark:hidden bg-[radial-gradient(ellipse_at_top_left,rgba(147,197,253,0.55),transparent_52%),radial-gradient(ellipse_at_top_right,rgba(125,211,252,0.45),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(191,219,254,0.6),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(186,230,253,0.4),transparent_50%)]" />
        <div className="auth-orb absolute -top-28 -left-24 h-[30rem] w-[30rem] rounded-full bg-blue-300/50 blur-3xl dark:bg-blue-500/20" />
        <div className="auth-orb-alt absolute -top-24 -right-20 h-[28rem] w-[28rem] rounded-full bg-sky-300/45 blur-3xl dark:bg-cyan-400/15" />
        <div className="auth-orb absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-blue-200/55 blur-3xl dark:bg-blue-500/10" />
        <div className="auth-orb-alt absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-400/10" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}
