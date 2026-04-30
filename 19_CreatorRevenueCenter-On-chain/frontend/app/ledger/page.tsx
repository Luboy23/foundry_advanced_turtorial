import { RoleGate } from "@/components/layout/RoleGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { LedgerPageView } from "@/components/pages/LedgerPageView";

export default function LedgerPage() {
  return (
    <WorkspaceShell>
      <RoleGate expectedRole="creator">
        <LedgerPageView />
      </RoleGate>
    </WorkspaceShell>
  );
}
