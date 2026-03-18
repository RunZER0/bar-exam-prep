import BasicFeatureGate from '@/components/BasicFeatureGate';

export default function BanterLayout({ children }: { children: React.ReactNode }) {
  return <BasicFeatureGate>{children}</BasicFeatureGate>;
}
