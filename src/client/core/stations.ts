/** What the coordinator offers when its station is empty. */
import type { StationKind } from '../../shared/layout';

/** What each board agent is for: its board's icon, what it offers on the card over its head, and an example ask. */
export const STATION_INFO: Record<StationKind, { icon: string; offer: string; does: string; example: string }> = {
  coordinator: { icon: '🧑‍💼', offer: 'Ask me about the plan', does: 'I keep the phase board and drive it', example: 'What is left in this phase?' },
};
