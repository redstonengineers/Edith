import { Route, Routes } from 'react-router-dom';
import ExamDetail from './ExamDetail';
import ExamList from './ExamList';
export default function ExamsPage() { return <Routes><Route index element={<ExamList />} /><Route path=":id" element={<ExamDetail />} /></Routes>; }
