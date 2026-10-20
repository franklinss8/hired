import Home from "@/components/Home";
import { getStats, isDemo } from "@/lib/data";

export const revalidate = 30;

export default async function HomePage() {
  const stats = await getStats();
  return <Home stats={stats} demo={isDemo} />;
}
