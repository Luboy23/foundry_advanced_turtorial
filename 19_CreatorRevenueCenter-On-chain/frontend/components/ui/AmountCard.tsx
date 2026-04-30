import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function AmountCard({
  title,
  value,
  hint,
  badge
}: {
  title: string;
  value: string;
  hint?: string;
  badge?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm text-text-muted">{title}</CardTitle>
          {badge ? <Badge variant="default">{badge}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-black tracking-tight text-text-ink">{value}</div>
        {hint ? <p className="text-xs leading-6 text-text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
