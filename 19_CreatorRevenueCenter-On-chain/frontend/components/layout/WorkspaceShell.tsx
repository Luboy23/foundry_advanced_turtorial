import type { ReactNode } from "react";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceTopbar } from "@/components/layout/WorkspaceTopbar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-stretch">
      <WorkspaceSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopbar />
        <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
