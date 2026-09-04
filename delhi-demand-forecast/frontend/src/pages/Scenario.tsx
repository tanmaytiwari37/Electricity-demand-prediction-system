import ScenarioPanel from '../components/ScenarioPanel.tsx'
import Panel from '../components/ui/Panel.tsx'
import { Badge } from '../components/ui/Badges.tsx'
import { CapacityInput } from '../components/ui/Controls.tsx'

export default function Scenario() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">What-if simulator</h1>
          <p className="text-xs text-ink-3">What happens if tomorrow is hotter? How much does rooftop solar change net demand? Move the sliders; the scenario is recomputed against the baseline forecast.</p>
        </div>
        <div className="md:hidden"><CapacityInput /></div>
      </div>
      <Panel title="Scenario" badges={<Badge kind="assumption" small />}>
        <ScenarioPanel />
      </Panel>
    </div>
  )
}
