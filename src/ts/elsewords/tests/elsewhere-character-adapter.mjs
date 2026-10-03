import assert from 'node:assert/strict';
import { applyTranslatableCard, createConfirmedSave, normalizeModelResponse, toTranslatableCard } from '../characterAdapter.js';

const character = {
  chaId: 'demo',
  name: 'Luna',
  desc: 'A curious explorer.',
  personality: 'Warm',
  scenario: 'A library',
  firstMessage: 'Hello',
  exampleMessage: 'Example',
  creatorNotes: 'Notes',
  systemPrompt: 'System',
  postHistoryInstructions: 'History note',
  alternateGreetings: ['Hi again'],
  image: 'assets/current.png',
  globalLore: [{ key: 'moon', content: 'Moon lore', enabled: true }],
  technicalValue: { preserve: true },
};

const card = toTranslatableCard(character);
assert.equal(card.data.description, 'A curious explorer.');
assert.deepEqual(card.data.character_book.entries, [{
  keys: ['moon'], secondary_keys: [], content: 'Moon lore', name: '', insertion_order: 0,
  constant: false, selective: false, use_regex: false, extensions: {},
}], 'active-character lore keeps the keys required by Elsewhere import');

const translated = structuredClone(card);
translated.data.description = 'Une exploratrice curieuse.';
translated.data.post_history_instructions = 'Note historique';
translated.data.character_book.entries[0].content = 'Savoir lunaire';
const updated = applyTranslatableCard(character, translated);
assert.equal(updated.desc, 'Une exploratrice curieuse.');
assert.equal(updated.postHistoryInstructions, 'Note historique');
assert.equal(updated.globalLore[0].content, 'Savoir lunaire');
assert.deepEqual(updated.technicalValue, { preserve: true });
assert.equal(character.desc, 'A curious explorer.');
assert.throws(() => applyTranslatableCard(character, { data: { ...translated.data, character_book: { entries: [] } } }), /lorebook changed/);
assert.throws(() => toTranslatableCard(null), /supported character/);
assert.throws(() => toTranslatableCard({ type: 'group', chaId: 'group', name: 'Group' }), /supported character/);
assert.throws(() => toTranslatableCard({ ...character, desc: 42 }), /desc field is unsupported/);
assert.equal(normalizeModelResponse({ type: 'success', result: '{"translations":[]}' }), '{"translations":[]}');
assert.throws(() => normalizeModelResponse({ type: 'fail', result: 'No configured model' }), /No configured model/);
assert.throws(() => normalizeModelResponse({ text: 'not supported' }), /invalid model response/);

const sparseCharacter = { chaId: 'sparse', name: 'Sparse', globalLore: [] };
const sparseUpdated = applyTranslatableCard(sparseCharacter, toTranslatableCard(sparseCharacter));
assert.equal(Object.hasOwn(sparseUpdated, 'desc'), false, 'missing optional fields must not be written during save');

let savedCharacter;
const confirmSave = createConfirmedSave({
  getCharacter: async () => structuredClone(character),
  setCharacter: async (next) => { savedCharacter = next; },
}, character, translated);
assert.equal(savedCharacter, undefined, 'creating a pending save must not update Elsewhere');
await confirmSave();
assert.equal(savedCharacter.desc, 'Une exploratrice curieuse.');
assert.equal(savedCharacter.image, 'assets/current.png', 'text-only saves preserve the current portrait');

const portraitBytes = Uint8Array.of(137, 80, 78, 71);
let savedWithPortrait;
let savedPortraitBytes;
const saveWithPortrait = createConfirmedSave({
  getCharacter: async () => structuredClone(character),
  setCharacter: async (next) => { savedWithPortrait = next; },
  savePortrait: async (bytes) => { savedPortraitBytes = bytes; return 'assets/new.png'; },
}, character, translated, { portraitBytes });
await saveWithPortrait();
assert.equal(savedWithPortrait.image, 'assets/new.png', 'an explicitly selected portrait replaces the current profile image');
assert.equal(savedPortraitBytes, portraitBytes);
assert.equal(character.image, 'assets/current.png', 'preparing an image replacement leaves the original untouched');

let replacedAfterChange = false;
const changedPortraitSave = createConfirmedSave({
  getCharacter: async () => ({ ...structuredClone(character), image: 'assets/changed.png' }),
  setCharacter: async () => { replacedAfterChange = true; },
  savePortrait: async () => { replacedAfterChange = true; return 'assets/new.png'; },
}, character, translated, { portraitBytes });
await assert.rejects(changedPortraitSave, /portrait changed/);
assert.equal(replacedAfterChange, false, 'a changed portrait is not overwritten or stored');

let savedAfterPortraitFailure = false;
const failedPortraitSave = createConfirmedSave({
  getCharacter: async () => structuredClone(character),
  setCharacter: async () => { savedAfterPortraitFailure = true; },
  savePortrait: async () => '',
}, character, translated, { portraitBytes });
await assert.rejects(failedPortraitSave, /did not save the selected portrait/);
assert.equal(savedAfterPortraitFailure, false, 'character text is not saved when portrait storage fails');

let savedWithHostMetadata;
const metadataPreservingSave = createConfirmedSave({
  getCharacter: async () => ({ ...structuredClone(character), technicalValue: { preserve: false, hostOnly: 'new' } }),
  setCharacter: async (next) => { savedWithHostMetadata = next; },
}, character, translated);
await metadataPreservingSave();
assert.equal(savedWithHostMetadata.desc, 'Une exploratrice curieuse.');
assert.deepEqual(savedWithHostMetadata.technicalValue, { preserve: false, hostOnly: 'new' }, 'untranslated host metadata does not cause a false conflict and is preserved');

let changedCharacterSaveCalls = 0;
const changedCharacterSave = createConfirmedSave({
  getCharacter: async () => ({ ...structuredClone(character), desc: 'Changed while translating.' }),
  setCharacter: async () => { changedCharacterSaveCalls += 1; },
}, character, translated);
await assert.rejects(changedCharacterSave, /active character changed/);
assert.equal(changedCharacterSaveCalls, 0, 'a changed character must not be saved');

let rejectedSaveCalls = 0;
const saveError = new Error('Elsewhere save failed.');
const rejectedSave = createConfirmedSave({
  getCharacter: async () => structuredClone(character),
  setCharacter: async () => {
    rejectedSaveCalls += 1;
    throw saveError;
  },
}, character, translated);
await assert.rejects(rejectedSave, (error) => error === saveError);
assert.equal(rejectedSaveCalls, 1, 'a rejected save must be attempted exactly once');

console.log('Elsewhere character adapter validated.');
