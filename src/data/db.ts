import type {
  Academy, ActivityLog, Attendance, ClassSession, Classroom, DocumentFile, Enrollment, Exam, Grade, Group,
  Guardian, Incident, Message, Notification, Payment, Practice, Settings, Student, Subject, Teacher, User, Vehicle, WaitlistEntry,
} from '@/types';

/** Forma de la "base de datos". Cada tabla (salvo `academies`) lleva `academyId`. */
export interface Database {
  academies: Academy[];
  settings: Settings[];
  users: User[];
  students: Student[];
  guardians: Guardian[];
  teachers: Teacher[];
  subjects: Subject[];
  classrooms: Classroom[];
  groups: Group[];
  classes: ClassSession[];
  enrollments: Enrollment[];
  waitlist: WaitlistEntry[];
  attendance: Attendance[];
  exams: Exam[];
  grades: Grade[];
  payments: Payment[];
  incidents: Incident[];
  documents: DocumentFile[];
  notifications: Notification[];
  messages: Message[];
  activity: ActivityLog[];
  vehicles: Vehicle[];
  practices: Practice[];
}
