// Reads the server's Prisma schema and writes src/db/schema.gen.ts: what the
// in-memory database (src/db/memdb.ts) needs to know about each model.
//
//   node scripts/gen-schema.mjs           writes the file
//   node scripts/gen-schema.mjs --check   exits 1 if the file is out of date
//
// The World keeps the server's tables and field names, so the services ported
// from apps/api run on it with few changes (docs/plan-solo-offline.md, section 5).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../../../apps/api/prisma/schema.prisma');
const outPath = path.resolve(here, '../src/db/schema.gen.ts');

/** Splits an attribute list like `@id @default(cuid()) @relation(fields: [a], references: [b])`. */
function attributes(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '@') {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < text.length && /[\w.@]/.test(text[j])) j++;
    const name = text.slice(i + 1, j);
    let args = null;
    if (text[j] === '(') {
      let depth = 0;
      let k = j;
      let inString = false;
      for (; k < text.length; k++) {
        const c = text[k];
        if (c === '"' && text[k - 1] !== '\\') inString = !inString;
        if (inString) continue;
        if (c === '(') depth++;
        if (c === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      args = text.slice(j + 1, k);
      j = k + 1;
    }
    out.push({ name, args });
    i = j;
  }
  return out;
}

/** `[a, b]` -> ['a', 'b'] */
const list = (text) => text.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);

/** Named arguments of @relation / @@unique: `fields: [a], references: [b], onDelete: Cascade`. */
function namedArgs(text) {
  const out = {};
  const re = /(\w+)\s*:\s*(\[[^\]]*\]|"[^"]*"|\w+)/g;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2];
  return out;
}

function parseDefault(args, type, isList, enums) {
  const raw = args.trim();
  const fn = /^(\w+)\(\)$/.exec(raw);
  if (fn) return { fn: fn[1] };
  if (raw === '[]') return { value: [] };
  if (raw.startsWith('"')) {
    const str = JSON.parse(raw);
    return { value: type === 'Json' ? JSON.parse(str) : str };
  }
  if (raw === 'true' || raw === 'false') return { value: raw === 'true' };
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { value: Number(raw) };
  if (enums.has(type)) return { value: raw };
  if (isList && raw.startsWith('[')) return { value: list(raw).map((v) => JSON.parse(v)) };
  throw new Error(`Unknown default ${raw} for ${type}`);
}

function parse(schema) {
  const text = schema.replace(/\/\/.*$/gm, '');
  const blocks = [...text.matchAll(/^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const enums = new Set(blocks.filter((b) => b[1] === 'enum').map((b) => b[2]));
  const modelNames = new Set(blocks.filter((b) => b[1] === 'model').map((b) => b[2]));
  const models = {};
  for (const [, kind, name, body] of blocks) {
    if (kind !== 'model') continue;
    const fields = {};
    const uniques = [];
    let id = null;
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('@@')) {
        for (const attr of attributes(line.slice(1))) {
          if (attr.name === 'unique' || attr.name === 'id') {
            const fieldsArg = attr.args.trim().startsWith('[') ? attr.args.trim().match(/^\[[^\]]*\]/)[0] : namedArgs(attr.args).fields;
            const keys = list(fieldsArg);
            if (attr.name === 'id') id = keys;
            uniques.push(keys);
          }
        }
        continue;
      }
      const m = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line);
      if (!m) throw new Error(`Cannot read ${name}: ${line}`);
      const [, field, type, listMark, optional, rest] = m;
      const isList = Boolean(listMark);
      const attrs = attributes(rest);
      const meta = {
        kind: modelNames.has(type) ? 'relation' : enums.has(type) ? 'enum' : 'scalar',
        type,
        list: isList,
        optional: Boolean(optional),
      };
      for (const attr of attrs) {
        if (attr.name === 'id') {
          meta.id = true;
          id = [field];
          uniques.push([field]);
        } else if (attr.name === 'unique') {
          meta.unique = true;
          uniques.push([field]);
        } else if (attr.name === 'default') {
          meta.default = parseDefault(attr.args, type, isList, enums);
        } else if (attr.name === 'updatedAt') {
          meta.updatedAt = true;
        } else if (attr.name === 'relation') {
          const args = namedArgs(attr.args);
          meta.relation = {
            ...(args.name ? { name: JSON.parse(args.name) } : {}),
            ...(attr.args.trim().startsWith('"') ? { name: JSON.parse(attr.args.trim().match(/^"[^"]*"/)[0]) } : {}),
            fields: args.fields ? list(args.fields) : [],
            references: args.references ? list(args.references) : [],
            ...(args.onDelete ? { onDelete: args.onDelete } : {}),
          };
        }
      }
      fields[field] = meta;
    }
    if (!id) throw new Error(`${name} has no @id`);
    models[name] = { name, delegate: name[0].toLowerCase() + name.slice(1), id, uniques, fields };
  }
  return { models, enums: [...enums] };
}

function render({ models }) {
  const lines = [
    '// Generated by scripts/gen-schema.mjs from apps/api/prisma/schema.prisma. Do not edit by hand:',
    '// change the schema, then run `npm run gen:schema -w @dark/solo`.',
    "import type { ModelMeta } from './meta.js';",
    '',
    'export const MODELS: Record<string, ModelMeta> = {',
  ];
  for (const model of Object.values(models)) {
    lines.push(`  ${model.name}: {`);
    lines.push(`    name: ${JSON.stringify(model.name)}, delegate: ${JSON.stringify(model.delegate)}, id: ${JSON.stringify(model.id)},`);
    lines.push(`    uniques: ${JSON.stringify(model.uniques)},`);
    lines.push('    fields: {');
    for (const [name, field] of Object.entries(model.fields)) lines.push(`      ${name}: ${JSON.stringify(field)},`);
    lines.push('    },');
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

const output = render(parse(fs.readFileSync(schemaPath, 'utf8')));
if (process.argv.includes('--check')) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current.replace(/\r\n/g, '\n') !== output) {
    console.error('src/db/schema.gen.ts is out of date: run `npm run gen:schema -w @dark/solo`');
    process.exit(1);
  }
  console.log('schema.gen.ts is up to date');
} else {
  fs.writeFileSync(outPath, output);
  console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
}
