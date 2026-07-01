import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-violet-grad shadow-glow">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M4 6a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4 3v-3a3 3 0 0 1-1-2V6Z"
            fill="white"
            opacity="0.95"
          />
          <circle cx="20" cy="16" r="3.5" fill="white" opacity="0.55" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-white">
        Stranger<span className="gradient-text">Chat</span>
      </span>
    </Link>
  );
}
