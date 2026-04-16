import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: number;
};

export function Logo({ className, size = 36 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block", className)}
      aria-hidden="true"
    >
      <path
        d="M50 5L15 20V45C15 67.5 30 88 50 95C70 88 85 67.5 85 45V20L50 5Z"
        fill="currentColor"
        className="text-brand-green"
      />
      <path
        d="M42 35C42 32 44 30 47 30H53C56 30 58 32 58 35V42H65C67 42 68 44 68 46V75C68 77 66 79 64 79H36C34 79 32 77 32 75V46C32 44 33 42 35 42H42V35Z"
        fill="currentColor"
        className="text-brand-amber"
      />
      <rect x="45" y="38" width="10" height="2" fill="white" fillOpacity="0.3" />
    </svg>
  );
}
