import { Route, Routes } from 'react-router-dom';
import GroupDetail from './GroupDetail';
import GroupList from './GroupList';
export default function GroupsPage() { return <Routes><Route index element={<GroupList />} /><Route path=":id" element={<GroupDetail />} /></Routes>; }
