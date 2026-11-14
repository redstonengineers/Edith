import { Route, Routes } from 'react-router-dom';
import TeacherList from './TeacherList';
import TeacherProfile from './TeacherProfile';
export default function TeachersPage() { return <Routes><Route index element={<TeacherList />} /><Route path=":id" element={<TeacherProfile />} /></Routes>; }
