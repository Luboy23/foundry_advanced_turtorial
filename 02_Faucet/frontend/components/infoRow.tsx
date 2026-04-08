import type { ReactNode } from "react";

type InfoRowProps = {
  label: string;
  value: ReactNode;
};

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="mb-8 flex justify-between">
      <p className="text-left w-1/3">{label}:</p>
      <p className="text-center w-2/3">{value}</p>
    </div>
  );
}
