import type { Snapshot } from '@/services/repositories';
import type { User } from '@/types';

export interface AIAnswer { text: string; items?: { label: string; href?: string }[]; suggestions?: string[]; kind?: 'answer' | 'refusal' | 'unknown' }
export interface AIRequest { question: string; history: { role: 'user' | 'ai'; text: string }[]; snapshot: Snapshot; user: User }

/**
 * Contrato del asistente. El resto de la app solo conoce esta interfaz.
 *  - MockAIProvider: motor determinista local (sin red).
 *  - HttpAIProvider: POST {API}/ai/chat. La clave del modelo vive SOLO en el servidor, que construye el contexto
 *    acotado por academy_id y permisos del usuario autenticado (nunca se envía el snapshot completo desde el cliente).
 */
export interface AIProvider { id: 'mock' | 'http'; label: string; ask(req: AIRequest): Promise<AIAnswer> }
