import { AppDataProvider } from "@/lib/hooks/useAppData";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="min-h-screen bg-background">{children}</div>
      <BottomNav />
    </AppDataProvider>
  );
}
