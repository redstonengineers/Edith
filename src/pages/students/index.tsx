import { Route, Routes } from 'react-router-dom';
import StudentList from './StudentList';
import StudentProfile from './StudentProfile';

export default function StudentsPage() {
  return <Routes><Route index element={<StudentList />} /><Route path=":id" element={<StudentProfile />} /></Routes>;
}
