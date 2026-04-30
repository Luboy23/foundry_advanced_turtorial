import { RoleGate } from "@/components/layout/RoleGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { PlatformResultsView } from "@/components/pages/PlatformResultsView";

export default function PlatformResultsPage() {
  return (
    <WorkspaceShell>
      <RoleGate expectedRole="platform">
        <PlatformResultsView />
      </RoleGate>
    </WorkspaceShell>
  );
}
