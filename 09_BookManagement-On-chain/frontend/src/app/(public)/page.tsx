import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// 公共首页：承载产品定位与角色分流，不直接发起链上读写。
export default function HomePage() {
  return (
    <main className="bg-background">
      <section className="py-16 lg:py-24">
        <div className="container mx-auto flex flex-col gap-12 px-6 lg:flex-row lg:items-center">
          {/* 左侧：定位 + 角色入口按钮 */}
          <div className="flex-1 space-y-6">
            <Badge variant="outline">图书借阅平台</Badge>
            <h1 className="text-4xl font-semibold text-foreground md:text-5xl">
              校内图书借阅管理平台
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              面向馆员与读者的链上业务系统。馆员负责馆藏与借阅登记，读者可完成注册并查询个人借阅历史。
            </p>
            {/* 角色入口：馆员进入管理端，读者进入读者中心 */}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin">进入馆员工作台</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/reader">进入读者中心</Link>
              </Button>
            </div>
          </div>

          <div className="flex-1">
            {/* 右侧：用一张卡片把链上借阅主流程讲清楚 */}
            <Card>
              <CardHeader>
                <CardTitle>业务闭环</CardTitle>
                <CardDescription>标准借阅链路：馆藏录入 → 借还登记 → 链上台账查询。</CardDescription>
              </CardHeader>
              <CardContent>
                {/* 首页用步骤卡解释最小业务闭环，帮助首次访问者建立流程认知 */}
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li>1. 馆员录入书籍摘要并设置库存。</li>
                  <li>2. 读者连接钱包完成注册。</li>
                  <li>3. 馆员在借阅台账登记借阅/归还。</li>
                  <li>4. 读者查看个人借阅历史与可借书目。</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/30 py-12">
        <div className="container mx-auto grid gap-6 px-6 lg:grid-cols-3">
          {/* 功能概览卡：强调系统由馆员后台、链上台账、读者中心构成 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">馆员工作台</CardTitle>
              <CardDescription>仪表盘、馆藏、借阅台账、读者管理四大模块。</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">链上借阅台账</CardTitle>
              <CardDescription>借阅记录、库存状态与权限控制统一可审计。</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">读者中心</CardTitle>
              <CardDescription>注册、书目查询、个人借阅历史一站式查看。</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </main>
  );
}
