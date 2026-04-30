import { RoleGate } from "@/components/layout/RoleGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { CreatorDashboardView } from "@/components/pages/CreatorDashboardView";

export default function CreatorPage() {
  return (
    <WorkspaceShell>
      <RoleGate expectedRole="creator">
        <CreatorDashboardView />
      </RoleGate>
    </WorkspaceShell>
  );
}
