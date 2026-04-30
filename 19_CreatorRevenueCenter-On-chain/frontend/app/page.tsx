import { HomePageView } from "@/components/pages/HomePageView";
import { readHomePageInitialData } from "@/lib/server/page-data";

export default async function HomePage() {
  const initialData = await readHomePageInitialData();
  return <HomePageView initialBatch={initialData.batch} initialBill={initialData.bill} />;
}
