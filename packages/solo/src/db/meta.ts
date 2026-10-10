/** What the in-memory database knows about one model, read from the Prisma schema. */
export interface FieldMeta {
  /** A plain value, an enum (stored as its name), or a link to another model. */
  kind: 'scalar' | 'enum' | 'relation';
  /** String, Int, BigInt, Boolean, DateTime, Json, an enum's name, or a model's name. */
  type: string;
  list: boolean;
  optional: boolean;
  id?: boolean;
  unique?: boolean;
  updatedAt?: boolean;
  /** `{ fn: 'cuid' | 'now' | 'autoincrement' }` or a literal value. */
  default?: { fn: string } | { value: unknown };
  /** On the side that holds the foreign key: which fields point at which. Empty on the other side. */
  relation?: { name?: string; fields: string[]; references: string[]; onDelete?: string };
}

export interface ModelMeta {
  name: string;
  /** The client's property for it: `heroFloor` for HeroFloor. */
  delegate: string;
  id: string[];
  /** Every unique key, single and compound (the id included). */
  uniques: string[][];
  fields: Record<string, FieldMeta>;
}
