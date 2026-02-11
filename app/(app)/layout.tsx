import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { SidebarProvider } from '@/contexts/SidebarContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </SidebarProvider>
  );
}
