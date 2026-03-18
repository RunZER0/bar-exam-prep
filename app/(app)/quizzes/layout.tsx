import BasicFeatureGate from '@/components/BasicFeatureGate';

export default function QuizzesLayout({ children }: { children: React.ReactNode }) {
  return <BasicFeatureGate>{children}</BasicFeatureGate>;
}
