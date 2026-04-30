import { RoleGate } from "@/components/layout/RoleGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { CreatorHistoryView } from "@/components/pages/CreatorHistoryView";

export default function CreatorHistoryPage() {
  return (
    <WorkspaceShell>
      <RoleGate expectedRole="creator">
        <CreatorHistoryView />
      </RoleGate>
    </WorkspaceShell>
  );
}
