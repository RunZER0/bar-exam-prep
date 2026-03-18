import BasicFeatureGate from '@/components/BasicFeatureGate';

export default function MasteryLayout({ children }: { children: React.ReactNode }) {
  return <BasicFeatureGate>{children}</BasicFeatureGate>;
}
