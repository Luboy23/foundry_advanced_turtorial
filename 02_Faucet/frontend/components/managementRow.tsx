import type { ReactNode } from "react";

type ManagementRowProps = {
  label: string;
  value: ReactNode;
  onEdit?: () => void;
};

export function ManagementRow({ label, value, onEdit }: ManagementRowProps) {
  return (
    <div className="mb-8 text-xl flex justify-between items-center">
      <p className="text-left w-1/3">{label}:</p>
      <p className="text-center w-2/3">{value}</p>
      {label !== "当前账户" && onEdit ? (
        <button
          className="bg-white text-pink-600 px-4 py-2 rounded-md shadow-md hover:bg-gray-200 transition duration-300"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          style={{
            whiteSpace: "nowrap",
          }}
        >
          修改
        </button>
      ) : null}
    </div>
  );
}
