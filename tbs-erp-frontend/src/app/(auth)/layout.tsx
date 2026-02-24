export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      role="main"
      id="main-content"
    >
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
