import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell.tsx'
import Landing from './pages/Landing.tsx'
import Overview from './pages/Overview.tsx'
import Forecast from './pages/Forecast.tsx'
import Alerts from './pages/Alerts.tsx'
import Areas from './pages/Areas.tsx'
import Weather from './pages/Weather.tsx'
import Scenario from './pages/Scenario.tsx'
import Model from './pages/Model.tsx'

/** The landing page owns the root; every dashboard page sits inside the
 *  shell (sidebar + header). */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell><Outlet /></AppShell>}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/areas" element={<Areas />} />
        <Route path="/weather" element={<Weather />} />
        <Route path="/scenario" element={<Scenario />} />
        <Route path="/model" element={<Model />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
