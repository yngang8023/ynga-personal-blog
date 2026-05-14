import { Link } from "@remix-run/react";

export const meta = () => {
  return [{ title: "HiYnga Blog RAG" }];
};

export default function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-50">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold">HiYnga Blog RAG</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          This Cloudflare service powers the embedded AI assistant for the Mizuki blog.
        </p>
        <Link
          to="/embed"
          className="mt-6 inline-flex rounded-full bg-white px-5 py-2 text-sm font-medium text-zinc-950"
        >
          Open Embed Chat
        </Link>
      </div>
    </main>
  );
}
