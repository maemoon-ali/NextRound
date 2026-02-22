import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 px-4">
      <h1 className="text-xl font-semibold text-white">This page could not be found</h1>
      <p className="mt-2 text-sm text-zinc-400">The route may be invalid or the app may need a refresh.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
      >
        Go to home
      </Link>
    </div>
  );
}
