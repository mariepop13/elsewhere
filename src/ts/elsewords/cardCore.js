import { finalResponseText } from './responseText.js';
// Adapted from Marie's Elsewords sources at c634135d; maintained natively in Elsewhere.
const TEXT_FIELDS = new Set([
  'description', 'personality', 'scenario', 'first_mes', 'firstMes', 'mes_example',
  'mesExample', 'creator_notes', 'creatorNotes', 'system_prompt', 'systemPrompt',
  'post_history_instructions', 'postHistoryInstructions', 'alternate_greetings',
  'alternateGreetings', 'prompt',
]);

const TOKEN_PATTERN = /\{\{[^{}]+\}\}|https?:\/\/[^\s<]+|<[^>]*>|```[\s\S]*?```|`[^`]*`|\*+|~+|[\[\]\(\)]|\r?\n/g;
const PROTECTED_MARKER_PATTERN = /⟦EW\d+⟧/g;

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function cardData(card) {
  if (!isObject(card)) throw new Error('The imported JSON must be a character card object.');
  if (card.spec === 'chara_card_v2' || card.spec === 'chara_card_v3') {
    if (!isObject(card.data)) throw new Error('The CCv3 card is missing its object-valued data section.');
    return validateCardData(card.data);
  }
  if (Object.prototype.hasOwnProperty.call(card, 'character')) {
    if (!isObject(card.character)) throw new Error('The SillyTavern card wrapper must contain a character object.');
    return validateCardData(card.character);
  }
  if (Object.prototype.hasOwnProperty.call(card, 'spec')) throw new Error('The JSON uses an unsupported character-card specification.');
  return validateCardData(card);
}

export function cardForElsewhereExport(card) {
  const data = cardData(card);
  const exported = clone(card);
  if (exported.spec === 'chara_card_v2' || exported.spec === 'chara_card_v3') {
    const extensions = data.extensions;
    if (extensions === undefined) exported.data.extensions = {};
    else if (!isObject(extensions)) throw new Error('The character card extensions must be an object for Elsewhere import.');
  }
  return exported;
}

export function cardForElsewhereCreation(card) {
  const data = clone(cardData(card));
  const spec = card.spec === 'chara_card_v3' ? 'chara_card_v3' : 'chara_card_v2';
  const defaults = {
    description: '', personality: '', scenario: '', first_mes: '', mes_example: '',
    creator_notes: '', system_prompt: '', post_history_instructions: '',
    alternate_greetings: [], tags: [], creator: '', character_version: '', extensions: {},
  };
  if (spec === 'chara_card_v3') Object.assign(defaults, { group_only_greetings: [], assets: [] });
  const book = data.character_book;
  if (book !== undefined && (!isObject(book) || !Array.isArray(book.entries))) {
    throw new Error('The character card lorebook must contain an entries array.');
  }
  const characterBook = book ?? { entries: [] };
  if (characterBook.entries.some((entry) => !isObject(entry))) {
    throw new Error('The character card lorebook contains an invalid entry.');
  }
  characterBook.extensions ??= {};
  characterBook.entries = characterBook.entries.map((entry) => ({
    enabled: true, insertion_order: 100, extensions: {}, ...entry,
  }));
  return {
    spec, spec_version: spec === 'chara_card_v3' ? '3.0' : '2.0',
    data: { ...defaults, ...data, character_book: characterBook },
  };
}

export function cardExportFilename(card, kind, format) {
  const name = cardData(card).name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 70) || 'character';
  return `${name}-${kind}.${format}`;
}

function validateCardData(card) {
  if (typeof card.name !== 'string' || !card.name.trim()) {
    throw new Error('The character card must include a non-empty name.');
  }
  return card;
}

export function collectTranslatableFields(card, { translateNames = true, includeEmpty = false } = {}) {
  const root = cardData(card);
  const fields = [];
  walk(root, [], false);
  return fields;

  function walk(value, path, inLorebookEntry) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...path, index], inLorebookEntry));
      return;
    }
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const nextPath = [...path, key];
      const isName = key === 'name';
      const isTextField = TEXT_FIELDS.has(key) || (inLorebookEntry && key === 'content');
      if ((isTextField || (translateNames && isName)) && typeof child === 'string' && (includeEmpty || child.trim())) {
        fields.push({ id: `f${fields.length}`, path: nextPath, text: child });
        continue;
      }
      if (isTextField && Array.isArray(child)) {
        child.forEach((item, index) => {
          if (typeof item === 'string' && (includeEmpty || item.trim())) fields.push({ id: `f${fields.length}`, path: [...nextPath, index], text: item });
        });
        continue;
      }
      const nextLorebookEntry = inLorebookEntry || (key === 'entries' && path[path.length - 1] === 'character_book');
      walk(child, nextPath, nextLorebookEntry);
    }
  }
}

export function protectText(text) {
  const tokens = [];
  const protectedText = text.replace(TOKEN_PATTERN, (match) => {
    const marker = `⟦EW${tokens.length}⟧`;
    tokens.push({ marker, value: match });
    return marker;
  });
  return { protectedText, tokens };
}

export function restoreText(text, tokens) {
  let restored = removeDuplicateProtectedMarkers(text, tokens);
  const seen = new Set();
  for (const token of tokens) {
    const count = restored.split(token.marker).length - 1;
    if (count !== 1) throw new Error('A protected formatting token was changed by the model.');
    seen.add(token.marker);
    restored = restored.replace(token.marker, token.value);
  }
  if (/⟦EW\d+⟧/.test(restored) || seen.size !== tokens.length) {
    throw new Error('The model returned an unknown protected token.');
  }
  return restored;
}

function removeDuplicateProtectedMarkers(text, tokens) {
  const matches = [...text.matchAll(PROTECTED_MARKER_PATTERN)];
  const expected = new Set(tokens.map((token) => token.marker));
  if (matches.some((match) => !expected.has(match[0]))) throw new Error('The model returned an unknown protected token.');
  const selected = new Set();
  let before = Infinity;
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const marker = tokens[index].marker;
    const occurrence = matches.findLastIndex((match) => match[0] === marker && match.index < before);
    if (occurrence < 0) throw new Error('A protected formatting token was changed by the model.');
    selected.add(occurrence);
    before = matches[occurrence].index;
  }
  let normalized = '';
  let cursor = 0;
  matches.forEach((match, index) => {
    normalized += text.slice(cursor, match.index);
    if (selected.has(index)) normalized += match[0];
    cursor = match.index + match[0].length;
  });
  return normalized + text.slice(cursor);
}

export function createBatches(fields, maxCharacters = 6000) {
  const batches = [];
  let current = [];
  let size = 0;
  for (const field of fields) {
    const protectedValue = protectText(field.text);
    const entry = { id: field.id, text: protectedValue.protectedText, tokens: protectedValue.tokens };
    if (entry.text.length > maxCharacters) throw new Error('One field is too long to translate safely.');
    if (current.length && size + entry.text.length > maxCharacters) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(entry);
    size += entry.text.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

function responseText(raw) {
  if (typeof raw !== 'string') throw new Error('The model response was not text.');
  return finalResponseText(raw);
}

function directJsonValue(raw) {
  const text = responseText(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const value = JSON.parse(text);
    return typeof value === 'string' ? directJsonValue(value) : value;
  } catch { return undefined; }
}

function jsonObjectCandidates(raw) {
  const direct = directJsonValue(raw);
  if (isObject(direct)) return [direct];
  const text = responseText(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const candidates = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (start < 0) {
      if (character === '{') { start = index; depth = 1; }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        try { candidates.push(JSON.parse(text.slice(start, index + 1))); } catch { /* Ignore malformed prose fragments. */ }
        start = -1;
      }
    }
  }
  if (start >= 0 || inString) throw new Error('The model response contains incomplete JSON.');
  return candidates.filter(isObject);
}

export function extractSingleJsonObject(raw) {
  const candidates = jsonObjectCandidates(raw);
  if (candidates.length !== 1) throw new Error('The model response must contain exactly one complete JSON object.');
  return JSON.stringify(candidates[0]);
}

function parseTranslations(parsed, batch) {
  const expected = new Set(batch.map((item) => item.id));
  const returned = new Map();
  for (const item of parsed.translations) {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.text !== 'string' || !expected.has(item.id) || returned.has(item.id)) {
      throw new Error('The translation response contains invalid or duplicate field identifiers.');
    }
    returned.set(item.id, item.text);
  }
  if (returned.size !== expected.size) throw new Error('The translation response omitted one or more fields.');
  return batch.map((item) => ({ id: item.id, text: restoreText(returned.get(item.id), item.tokens) }));
}

function asTranslationCandidate(value, batch) {
  if (Array.isArray(value)) return { translations: value };
  if (!isObject(value)) return null;
  if (Array.isArray(value.translations)) return value;
  const expected = new Set(batch.map((item) => item.id));
  const entries = Object.entries(value);
  if (entries.length === expected.size && entries.every(([id, text]) => expected.has(id) && typeof text === 'string')) {
    return { translations: entries.map(([id, text]) => ({ id, text })) };
  }
  return null;
}

function findTranslationCandidates(value, batch) {
  const direct = asTranslationCandidate(value, batch);
  if (direct) return [direct];
  if (Array.isArray(value)) return value.flatMap((item) => findTranslationCandidates(item, batch));
  return isObject(value) ? Object.values(value).flatMap((item) => findTranslationCandidates(item, batch)) : [];
}

export function parseBatchResponse(raw, batch) {
  let candidates;
  try {
    const direct = directJsonValue(raw);
    const roots = direct === undefined ? jsonObjectCandidates(raw) : [direct];
    candidates = roots.flatMap((item) => findTranslationCandidates(item, batch));
  } catch { throw new Error('The translation response was not valid JSON. Retry the translation.'); }
  if (candidates.length !== 1) throw new Error('The translation response must contain one complete translations object, array, or ID-to-text map. Retry the translation.');
  return parseTranslations(candidates[0], batch);
}

const GENERATED_CARD_REQUIRED_FIELDS = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'];

export function normalizeGeneratedCardPlaceholders(value) {
  if (Array.isArray(value)) return value.map(normalizeGeneratedCardPlaceholders);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeGeneratedCardPlaceholders(child)]));
  return typeof value === 'string'
    ? value.replaceAll('__ELS_USER_PLACEHOLDER__', '{{user}}').replaceAll('__ELS_CHAR_PLACEHOLDER__', '{{char}}')
    : value;
}

// Rewriting preserves distinct macro identities per field, not their accidental
// repetition count. Translation remains occurrence-exact through protected tokens.
function assertGeneratedMacros(original, candidate, path) {
  const required = new Set(normalizeGeneratedCardPlaceholders(original).match(/\{\{[^{}]*\}\}/g) || []);
  const normalized = normalizeGeneratedCardPlaceholders(candidate);
  if (/\{\{\s*\}\}|\{\{\{|\}\}\}/.test(normalized)) throw new Error(`The generated ${path.join(' › ')} contains a malformed role variable.`);
  const returned = new Set(normalized.match(/\{\{[^{}]*\}\}/g) || []);
  if ([...required].some((macro) => !returned.has(macro))) {
    throw new Error(`Preserve the staged {{…}} variables in ${path.join(' › ')}.`);
  }
  const remainder = normalized.replace(/\{\{[^{}]*\}\}/g, '');
  if (remainder.includes('{{') || remainder.includes('}}')) {
    throw new Error(`The generated ${path.join(' › ')} contains a malformed role variable.`);
  }
}

export function parseGeneratedCardResponse(raw) {
  let card;
  try { card = JSON.parse(extractSingleJsonObject(raw)); }
  catch { throw new Error('The generated character response was not valid JSON.'); }
  const normalized = normalizeGeneratedCardPlaceholders(card);
  let data;
  try { data = cardData(normalized); }
  catch { throw new Error('The generated character response was not a supported character card.'); }
  for (const field of collectTranslatableFields(normalized, { includeEmpty: true })) assertGeneratedMacros('', field.text, field.path);
  if (/\{\{[^{}]*\}\}/.test(data.name)) throw new Error('The generated character name must be a real name, not a role variable.');
  for (const field of GENERATED_CARD_REQUIRED_FIELDS) {
    if (!isMeaningfulGeneratedText(data[field])) {
      throw new Error(`The generated character card is missing meaningful ${field} content.`);
    }
  }
  return normalized;
}

function isMeaningfulGeneratedText(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const normalized = value.trim().replace(/[.…\s]/g, '').toLowerCase();
  return Boolean(normalized) && !['n/a', 'none', 'null', 'tbd', 'placeholder'].includes(normalized);
}

export function applyTranslations(card, fields, translations) {
  cardData(card);
  if (!Array.isArray(fields) || !Array.isArray(translations) || translations.length !== fields.length || fields.some((field) => !isObject(field) || typeof field.id !== 'string' || !Array.isArray(field.path)) || translations.some((item) => !isObject(item) || typeof item.id !== 'string' || typeof item.text !== 'string')) {
    throw new Error('The translated fields do not match the imported card.');
  }
  const translated = clone(card);
  const byId = new Map(translations.map((item) => [item.id, item.text]));
  if (byId.size !== fields.length || fields.some((field) => !byId.has(field.id) || typeof byId.get(field.id) !== 'string')) {
    throw new Error('The translated fields do not match the imported card.');
  }
  for (const field of fields) setAtPath(translated, field.path, byId.get(field.id));
  return translated;
}

// Output edits are staged independently of the immutable source and model result.
export function createOutputReview(output, original = null) {
  const originals = new Map(original ? collectTranslatableFields(original, { includeEmpty: true }).map((field) => [JSON.stringify(field.path), field.text]) : []);
  return collectTranslatableFields(output, { includeEmpty: true }).map((field) => ({
    id: field.id, path: [...field.path], baseline: field.text,
    original: originals.get(JSON.stringify(field.path)) ?? null,
    translation: field.text, draft: field.text,
  }));
}

export function applyOutputReview(output, review, { generated = false } = {}) {
  const canonical = collectTranslatableFields(output, { includeEmpty: true });
  if (!Array.isArray(review) || review.length !== canonical.length || review.some((field, index) => {
    const expected = canonical[index];
    return !isObject(field) || field.id !== expected.id || JSON.stringify(field.path) !== JSON.stringify(expected.path)
      || field.baseline !== expected.text || typeof field.draft !== 'string';
  })) throw new Error('The editable fields do not match the output card.');
  for (const field of review) {
    if (generated) assertGeneratedMacros(field.baseline, field.draft, field.path);
    const placeholders = (text) => (text.match(/\{\{[^{}]*\}\}/g) || []).sort();
    if (!generated && JSON.stringify(placeholders(field.baseline)) !== JSON.stringify(placeholders(field.draft))) {
      throw new Error(`Preserve the {{…}} variables in ${field.path.join(' › ')}.`);
    }
  }
  const result = applyTranslations(output, review, review.map((field) => ({ id: field.id, text: generated ? normalizeGeneratedCardPlaceholders(field.draft) : field.draft })));
  const data = cardData(result);
  if (generated && /\{\{[^{}]*\}\}/.test(data.name)) throw new Error('The generated character name must be a real name, not a role variable.');
  if (generated) for (const key of GENERATED_CARD_REQUIRED_FIELDS) {
    if (!isMeaningfulGeneratedText(data[key])) throw new Error(`The generated ${key} must not be empty or placeholder content.`);
  }
  return result;
}

// Completion changes supported prose only, retaining the loaded wrapper and metadata.
export function mergeCompletedCard(original, generated) {
  const result = clone(original);
  const sourceEntries = cardData(original).character_book?.entries;
  const generatedEntries = cardData(generated).character_book?.entries;
  if (generatedEntries !== undefined && sourceEntries !== undefined) {
    if (!Array.isArray(generatedEntries) || generatedEntries.length !== sourceEntries.length || sourceEntries.some((entry, index) => {
      const candidate = generatedEntries[index];
      return !isObject(candidate) || ['id', 'keys'].some((key) => entry[key] !== undefined && JSON.stringify(entry[key]) !== JSON.stringify(candidate[key]));
    })) throw new Error('The completed lorebook entries do not match the loaded card. Preserve their order, IDs and keys.');
  }
  const generatedFields = new Map(collectTranslatableFields(generated, { includeEmpty: true }).map((field) => [JSON.stringify(field.path), field.text]));
  for (const field of collectTranslatableFields(original, { includeEmpty: true })) {
    const value = generatedFields.get(JSON.stringify(field.path));
    const text = value === undefined ? undefined : normalizeGeneratedCardPlaceholders(value);
    if (text !== undefined) {
      assertGeneratedMacros(field.text, text, field.path);
      setAtPath(result, field.path, text);
    }
  }
  const source = cardData(result), candidate = cardData(generated);
  for (const key of ['name', ...TEXT_FIELDS]) if (!(key in source) && typeof candidate[key] === 'string') source[key] = candidate[key];
  return result;
}

export function setAtPath(object, path, value) {
  let target = cardData(object);
  for (let index = 0; index < path.length - 1; index += 1) target = target[path[index]];
  target[path[path.length - 1]] = value;
}

export function extractPngCard(base64) {
  const { bytes, cardChunks } = parsePng(base64);
  if (!cardChunks.length) throw new Error('No standard chara metadata was found in this PNG. Choose a PNG character card exported with chara metadata.');
  if (cardChunks.length > 1) throw new Error('The PNG contains multiple chara metadata entries. Export a PNG with one character card.');
  const metadata = cardChunks[0].data;
  const separator = metadata.indexOf(0);
  if (separator <= 0 || separator === metadata.length - 1) throw new Error('The PNG chara metadata is incomplete.');
  let encodedCard;
  try { encodedCard = decodeUtf8(metadata.slice(separator + 1)); } catch { throw new Error('The PNG chara metadata is not valid UTF-8 text.'); }
  let decodedCard;
  try { decodedCard = fromBase64(encodedCard); } catch { throw new Error('The PNG chara metadata is not valid Base64.'); }
  let card;
  try { card = JSON.parse(decodeUtf8(decodedCard)); } catch { throw new Error('The PNG chara metadata does not contain valid JSON.'); }
  try { cardData(card); } catch (error) { throw new Error(`The PNG chara metadata is not a supported character card: ${error.message}`); }
  return { card, png: toBase64(bytes) };
}

export function embedCardInPng(base64, card) {
  cardData(card);
  const { bytes, chunks, cardChunks } = parsePng(base64);
  if (cardChunks.length > 1) throw new Error('The PNG contains multiple chara metadata entries. Export a PNG with one character card.');
  const payload = concat(utf8('chara\0'), utf8(toBase64(utf8(JSON.stringify(card)))));
  const metadata = chunk('tEXt', payload);
  const output = chunks.flatMap((current) => {
    if (current.isCard) return [metadata];
    if (!cardChunks.length && text(current.raw.slice(4, 8)) === 'IEND') return [metadata, current.raw];
    return [current.raw];
  });
  return toBase64(concat(bytes.slice(0, 8), ...output));
}

function parsePng(base64) {
  let bytes;
  try { bytes = fromBase64(base64); } catch { throw new Error('The PNG file data is not valid Base64.'); }
  if (bytes.length < 8 || ![137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) throw new Error('The file is not a PNG image.');
  const chunks = [];
  const cardChunks = [];
  let offset = 8;
  let sawHeader = false;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = read32(bytes, offset);
    const type = text(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (end > bytes.length) throw new Error('The PNG data is truncated.');
    const raw = bytes.slice(offset, end);
    if (read32(bytes, dataEnd) !== crc32(bytes.slice(offset + 4, dataEnd))) throw new Error(`The PNG ${type} chunk has an invalid checksum.`);
    if (!sawHeader) {
      if (type !== 'IHDR' || length !== 13) throw new Error('The PNG is missing a valid IHDR header.');
      sawHeader = true;
    }
    if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) throw new Error('The PNG end marker is invalid.');
      sawEnd = true;
    }
    const data = bytes.slice(dataStart, dataEnd);
    const separator = type === 'tEXt' ? data.indexOf(0) : -1;
    let isCard = false;
    if (separator > 0) {
      let key;
      try { key = decodeUtf8(data.slice(0, separator)); } catch { throw new Error('The PNG text metadata is not valid UTF-8 text.'); }
      isCard = key.toLowerCase() === 'chara';
    }
    const current = { data, isCard, raw };
    chunks.push(current);
    if (isCard) cardChunks.push(current);
    offset = end;
    if (sawEnd) break;
  }
  if (!sawHeader || !sawEnd) throw new Error('The PNG is missing its end marker.');
  return { bytes, chunks, cardChunks };
}

function read32(bytes, offset) { return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0); }
function utf8(value) { return new TextEncoder().encode(value); }
function text(bytes) { return new TextDecoder().decode(bytes); }
function decodeUtf8(bytes) { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
function concat(...parts) { const size = parts.reduce((sum, part) => sum + part.length, 0); const result = new Uint8Array(size); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result; }
function toBase64(bytes) { let value = ''; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value); }
function fromBase64(value) { const binary = atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const result = new Uint8Array(data.length + 12); new DataView(result.buffer).setUint32(0, data.length); result.set(utf8(type), 4); result.set(data, 8); new DataView(result.buffer).setUint32(data.length + 8, crc32(result.slice(4, data.length + 8))); return result; }

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
