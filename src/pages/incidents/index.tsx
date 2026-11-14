import { Route, Routes } from 'react-router-dom';
import IncidentDetail from './IncidentDetail';
import IncidentList from './IncidentList';
export default function IncidentsPage() { return <Routes><Route index element={<IncidentList />} /><Route path=":id" element={<IncidentDetail />} /></Routes>; }
