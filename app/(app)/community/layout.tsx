import BasicFeatureGate from '@/components/BasicFeatureGate';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <BasicFeatureGate>{children}</BasicFeatureGate>;
}
