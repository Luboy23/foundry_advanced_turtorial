import { RoleGate } from "@/components/layout/RoleGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { CollaboratorDashboardView } from "@/components/pages/CollaboratorDashboardView";

export default function CollaboratorPage() {
  return (
    <WorkspaceShell>
      <RoleGate expectedRole="collaborator">
        <CollaboratorDashboardView />
      </RoleGate>
    </WorkspaceShell>
  );
}
