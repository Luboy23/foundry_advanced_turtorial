"use client";

import type { ReactNode } from "react";
import { InfoNotice } from "@/components/shared/StatePanels";
import { RoleGate } from "@/components/shared/RoleGate";
import type { SchoolFamilyKey } from "@/types/admission";

export function UniversityScopeGate({
  children
}: {
  children: (familyKey: SchoolFamilyKey) => ReactNode;
}) {
  return (
    <RoleGate expectedRole="university">
      {(identity) => {
        if (!identity.universityFamily) {
          return <InfoNotice title="当前账户未绑定学校" description="系统暂未识别当前账户对应的学校，无法进入大学工作台。" tone="warning" />;
        }
        return <>{children(identity.universityFamily)}</>;
      }}
    </RoleGate>
  );
}
