import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell.tsx'
import Overview from './pages/Overview.tsx'
import Forecast from './pages/Forecast.tsx'
import Alerts from './pages/Alerts.tsx'
import Areas from './pages/Areas.tsx'
import Weather from './pages/Weather.tsx'
import Scenario from './pages/Scenario.tsx'
import Model from './pages/Model.tsx'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/areas" element={<Areas />} />
        <Route path="/weather" element={<Weather />} />
        <Route path="/scenario" element={<Scenario />} />
        <Route path="/model" element={<Model />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
