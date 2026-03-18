import BasicFeatureGate from '@/components/BasicFeatureGate';

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return <BasicFeatureGate>{children}</BasicFeatureGate>;
}
