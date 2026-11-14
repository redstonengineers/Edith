import { can } from '@/lib/permissions';
import { AI_PROVIDER, API_BASE, IS_API } from '@/services/mode';
import { ROLE_LABELS } from '@/lib/permissions';
import { entityAnswer, INTENTS, matches, normQ } from './intents';
import type { AIAnswer, AIProvider, AIRequest } from './types';
export type { AIAnswer, AIProvider, AIRequest } from './types';

export const AI_SUGGESTIONS = ['¿Qué debería revisar hoy?', '¿Qué clases tengo mañana?', '¿Qué alumnos tienen baja asistencia?', '¿Qué grupos están completos?', '¿Cuánto dinero está pendiente de cobrar?', '¿Qué profesores tienen más horas esta semana?', '¿Qué alumnos están en lista de espera?'];
const HELP: AIAnswer = { text: 'No he encontrado una respuesta para eso. Puedo ayudarte con alumnos, clases, asistencia, exámenes, pagos, incidencias, lista de espera y grupos. También puedes escribir el nombre de un alumno, profesor o grupo.', kind: 'unknown', suggestions: ['¿Qué debería revisar hoy?', '¿Qué clases tengo hoy?'] };

/** Motor local determinista: intents por palabras clave + resolución de entidades. Respeta permisos del rol. */
export const mockAIProvider: AIProvider = {
  id: 'mock', label: 'Simulado',
  async ask({ question, snapshot, user }: AIRequest) {
    await new Promise((r) => setTimeout(r, 350));
    const nq = normQ(question); const ctx = { snap: snapshot, user, q: question, nq };
    if (!nq) return HELP;
    const hit = INTENTS.find((i) => matches(nq, i.keywords));
    if (hit) {
      if (hit.needs && !can(user, hit.needs)) return { text: `Tu rol (${ROLE_LABELS[user.role]}) no tiene acceso a esa información.`, kind: 'refusal' };
      return { kind: 'answer', ...hit.run(ctx) };
    }
    return entityAnswer(ctx) ?? HELP;
  },
};

/** Proveedor real: el backend aplica academy_id + permisos y llama al modelo. Sin claves en el cliente. */
export const httpAIProvider: AIProvider = {
  id: 'http', label: 'Servidor',
  async ask({ question, history }) {
    const res = await fetch(`${API_BASE}/ai/chat`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'academy-control' }, body: JSON.stringify({ question, history: history.slice(-10).map((m) => ({ role: m.role, text: m.text.slice(0, 500) })) }) });
    if (!res.ok) throw new Error(`El asistente no está disponible (${res.status})`);
    return (await res.json()) as AIAnswer;
  },
};

export const aiProvider: AIProvider = IS_API || AI_PROVIDER === 'http' ? httpAIProvider : mockAIProvider;
