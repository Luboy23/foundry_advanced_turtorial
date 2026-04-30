import { RoleGate } from "@/components/layout/RoleGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { PlatformHistoryView } from "@/components/pages/PlatformHistoryView";

export default function PlatformHistoryPage() {
  return (
    <WorkspaceShell>
      <RoleGate expectedRole="platform">
        <PlatformHistoryView />
      </RoleGate>
    </WorkspaceShell>
  );
}
