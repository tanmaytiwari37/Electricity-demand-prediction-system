import ScenarioPanel from '../components/ScenarioPanel.tsx'
import { PageHeader } from '../components/ui/Panel.tsx'

export default function Scenario() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Scenario simulator" subtitle="Explore how weather and rooftop solar could affect peak electricity demand." />
      <ScenarioPanel />
    </div>
  )
}
