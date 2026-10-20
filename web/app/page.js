import Entry from "@/components/Entry";
import { getStats, isDemo } from "@/lib/data";

export const revalidate = 30;

export default async function EntryPage() {
  const stats = await getStats();
  return <Entry stats={stats} demo={isDemo} />;
}
