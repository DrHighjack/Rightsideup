export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-16 text-white">
      <div className="mx-auto max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">North Shore Sign Co</p>
        <h1 className="mt-5 text-4xl font-semibold">This sign isn&apos;t in our system.</h1>
        <p className="mt-4 text-slate-300">The sign ID you tapped doesn&apos;t match an active listing or a recognized post.</p>
        <a href="https://northshoresignco.com" className="mt-6 inline-flex rounded-md bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400">Visit northshoresignco.com</a>
      </div>
    </main>
  );
}
