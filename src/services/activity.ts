import type { User } from '@/types';
import { getDatabase } from './database';

/** Punto único de auditoría. Los servicios de escritura lo llamarán dentro de cada operación. */
export function logActivity(actor: User, action: string, entityType: string, summary: string, entityId?: string) {
  const db = getDatabase();
  db.activity.unshift({
    academyId: actor.academyId, id: `${actor.academyId}_log_${Date.now()}`, at: new Date().toISOString(),
    actorId: actor.id, actorName: actor.name, action, entityType, entityId, summary,
  });
}
