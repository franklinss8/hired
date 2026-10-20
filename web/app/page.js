import Space from "@/components/Space";
import { getStats, isDemo } from "@/lib/data";

export const revalidate = 30;

export default async function Home() {
  const stats = await getStats();
  return <Space stats={stats} demo={isDemo} />;
}
