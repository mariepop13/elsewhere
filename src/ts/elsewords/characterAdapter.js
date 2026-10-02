// Adapted from Marie's Elsewords sources at c634135d; maintained natively in Elsewhere.
import { clone, collectTranslatableFields, setAtPath } from './cardCore.js';

const FIELD_MAP = Object.freeze({
  name: 'name',
  description: 'desc',
  personality: 'personality',
  scenario: 'scenario',
  first_mes: 'firstMessage',
  mes_example: 'exampleMessage',
  creator_notes: 'creatorNotes',
  system_prompt: 'systemPrompt',
  post_history_instructions: 'postHistoryInstructions',
  alternate_greetings: 'alternateGreetings',
});

function risuText(value) {
  return typeof value === 'string' ? value : '';
}

function assertSupportedCharacter(character) {
  if (!character || typeof character !== 'object' || Array.isArray(character) || character.type === 'group' || typeof character.chaId !== 'string' || typeof character.name !== 'string') {
    throw new Error('The open Elsewhere item is not a supported character.');
  }
  for (const [cardField, characterField] of Object.entries(FIELD_MAP)) {
    const value = character[characterField];
    if (value === undefined) continue;
    const valid = cardField === 'alternate_greetings'
      ? Array.isArray(value) && value.every((item) => typeof item === 'string')
      : typeof value === 'string';
    if (!valid) throw new Error(`The Elsewhere ${characterField} field is unsupported.`);
  }
  if (character.globalLore !== undefined && (!Array.isArray(character.globalLore) || !character.globalLore.every((entry) => entry && typeof entry === 'object' && (entry.content === undefined || typeof entry.content === 'string')))) {
    throw new Error('The Elsewhere lorebook is unsupported.');
  }
}

export function normalizeModelResponse(response) {
  if (typeof response === 'string') return response;
  if (response?.type === 'success' && typeof response.result === 'string') return response.result;
  if (response?.type === 'fail') throw new Error(typeof response.result === 'string' ? response.result : 'Elsewhere rejected the model request.');
  throw new Error('Elsewhere returned an invalid model response.');
}

export function toTranslatableCard(character) {
  assertSupportedCharacter(character);
  const data = {};
  for (const [cardField, characterField] of Object.entries(FIELD_MAP)) {
    data[cardField] = cardField === 'alternate_greetings'
      ? (character[characterField] ?? [])
      : risuText(character[characterField]);
  }
  data.character_book = {
    entries: (character.globalLore ?? []).map((entry) => ({
      keys: risuText(entry.key).split(',').map((key) => key.trim()).filter(Boolean),
      secondary_keys: risuText(entry.secondkey).split(',').map((key) => key.trim()).filter(Boolean),
      content: risuText(entry.content),
      name: risuText(entry.comment),
      insertion_order: entry.insertorder ?? 0,
      constant: entry.alwaysActive ?? false,
      selective: entry.selective ?? false,
      use_regex: entry.useRegex ?? false,
      extensions: entry.extentions && typeof entry.extentions === 'object' && !Array.isArray(entry.extentions) ? clone(entry.extentions) : {},
    })),
  };
  return { spec: 'chara_card_v2', spec_version: '2.0', data };
}

export function createConfirmedSave({ getCharacter, setCharacter, savePortrait }, originalCharacter, translatedCard, { portraitBytes } = {}) {
  if (typeof getCharacter !== 'function' || typeof setCharacter !== 'function') {
    throw new Error('Elsewhere character save APIs are unavailable.');
  }
  if (portraitBytes && (!(portraitBytes instanceof Uint8Array) || !portraitBytes.length || typeof savePortrait !== 'function')) {
    throw new Error('Elsewhere cannot save the selected portrait. The character was not changed.');
  }
  return async () => {
    const current = await getCharacter();
    if (!current || current.chaId !== originalCharacter?.chaId) {
      throw new Error('The active character changed while translation was in progress. Reload it before saving.');
    }
    const originalCard = toTranslatableCard(originalCharacter);
    const currentCard = toTranslatableCard(current);
    if (JSON.stringify(currentCard) !== JSON.stringify(originalCard)) {
      throw new Error('The active character changed while translation was in progress. Reload it before saving.');
    }
    if (portraitBytes && current.image !== originalCharacter.image) {
      throw new Error('The character portrait changed while editing. Reload the character before replacing its portrait.');
    }
    const updated = applyTranslatableCard(current, translatedCard);
    if (portraitBytes) {
      const path = await savePortrait(portraitBytes);
      if (typeof path !== 'string' || !path) throw new Error('Elsewhere did not save the selected portrait. The character was not changed.');
      updated.image = path;
    }
    await setCharacter(updated);
    return updated;
  };
}

export function applyTranslatableCard(character, translatedCard) {
  assertSupportedCharacter(character);
  const data = translatedCard?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The translated character data is invalid.');
  }

  const updated = clone(character);
  for (const [cardField, characterField] of Object.entries(FIELD_MAP)) {
    const translated = data[cardField];
    const valid = cardField === 'alternate_greetings'
      ? Array.isArray(translated) && translated.every((item) => typeof item === 'string')
      : typeof translated === 'string';
    if (!valid) throw new Error(`The translated ${cardField} is invalid.`);
    if (character[characterField] !== undefined || (Array.isArray(translated) ? translated.length > 0 : translated.trim())) updated[characterField] = translated;
  }

  const entries = data.character_book?.entries;
  if (!Array.isArray(entries) || !entries.every((entry) => typeof entry?.content === 'string')) {
    throw new Error('The translated lorebook entries are invalid.');
  }
  if (character.globalLore === undefined) {
    if (entries.length !== 0) throw new Error('The translated lorebook does not match the Elsewhere character.');
  } else {
    if (character.globalLore.length !== entries.length) throw new Error('The Elsewhere lorebook changed while translation was in progress. Reload it before saving.');
    updated.globalLore = character.globalLore.map((entry, index) => {
      const reviewed = entries[index];
      const result = { ...entry };
      if (entry.content !== undefined || reviewed.content.trim()) result.content = reviewed.content;
      if (reviewed.name !== undefined) {
        if (typeof reviewed.name !== 'string') throw new Error('The translated lorebook name is invalid.');
        if (typeof entry.comment === 'string' || reviewed.name.trim()) result.comment = reviewed.name;
      }
      if (entry.extentions && typeof entry.extentions === 'object' && !Array.isArray(entry.extentions) && reviewed.extensions !== undefined) {
        if (!reviewed.extensions || typeof reviewed.extensions !== 'object' || Array.isArray(reviewed.extensions)) throw new Error('The translated lorebook extensions are invalid.');
        result.extentions = applyReviewedExtensions(entry.extentions, reviewed.extensions);
      }
      return result;
    });
  }

  return updated;
}

function applyReviewedExtensions(original, reviewed) {
  const result = { name: 'Lorebook extensions', extensions: clone(original) };
  for (const field of collectTranslatableFields(result, { includeEmpty: true })) {
    if (field.path[0] !== 'extensions') continue;
    const value = field.path.slice(1).reduce((target, key) => target?.[key], reviewed);
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new Error('The translated lorebook extension text is invalid.');
    setAtPath(result, field.path, value);
  }
  return result.extensions;
}
