import { z } from 'zod';

// The Classes, on their own so that both Heroes and Items can name them
// without importing each other.
export const CLASS_IDS = ['fighter', 'rogue', 'wizard', 'cleric', 'barbarian', 'ranger', 'paladin', 'warlock', 'monk', 'druid', 'bard', 'sorcerer'] as const;
export const classIdSchema = z.enum(CLASS_IDS);
export type ClassId = z.infer<typeof classIdSchema>;
