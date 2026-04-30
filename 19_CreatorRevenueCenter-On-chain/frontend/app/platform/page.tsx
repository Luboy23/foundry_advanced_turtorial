import { RoleGate } from "@/components/layout/RoleGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { PlatformConsoleView } from "@/components/pages/PlatformConsoleView";

export default function PlatformPage() {
  return (
    <WorkspaceShell>
      <RoleGate expectedRole="platform">
        <PlatformConsoleView />
      </RoleGate>
    </WorkspaceShell>
  );
}
