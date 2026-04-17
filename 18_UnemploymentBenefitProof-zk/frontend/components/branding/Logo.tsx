export function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-9 w-9">
      <rect x="10" y="16" width="34" height="26" rx="6" fill="#22324A" opacity="0.12" />
      <path
        d="M12 22a6 6 0 0 1 6-6h12l4 5h12a6 6 0 0 1 6 6v9a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z"
        fill="#22324A"
      />
      <circle cx="44" cy="40" r="12" fill="#B6463A" />
      <path
        d="M44 31l2.4 4.8 5.3.8-3.8 3.7.9 5.2L44 43l-4.8 2.5.9-5.2-3.8-3.7 5.3-.8z"
        fill="#FFFDFC"
      />
    </svg>
  );
}
