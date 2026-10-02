import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGeneratedCardResponse, cardData, applyTranslations, createOutputReview, applyOutputReview, mergeCompletedCard, collectTranslatableFields, createBatches, parseBatchResponse, cardForElsewhereExport, embedCardInPng, extractPngCard } from '../cardCore.js';
import { applyTranslatableCard, createConfirmedSave, toTranslatableCard } from '../characterAdapter.js';
const png = (await readFile(new URL('./fixtures/ccv2.png', import.meta.url))).toString('base64');
const load = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const translatedFields = (fields) => parseBatchResponse(JSON.stringify(Object.fromEntries(createBatches(fields).flat().map((field) => [field.id, `Translated: ${field.text}`]))), createBatches(fields).flat());
for (const card of [await load('ccv2'), await load('ccv3'), await load('sillytavern'), extractPngCard(png).card]) {
  const original = JSON.stringify(card);
  const fields = collectTranslatableFields(card, { translateNames: false });
  const output = applyTranslations(card, fields, translatedFields(fields));
  const outputSnapshot = JSON.stringify(output);
  const review = createOutputReview(output, card);
  assert.ok(review.every((field) => typeof field.original === 'string'));
  const description = review.find((field) => field.path.join('.') === 'description');
  description.draft = `Edited: ${description.draft}`;
  const result = applyOutputReview(output, review);
  assert.equal(cardData(result).description, description.draft);
  assert.equal(cardData(result).name, cardData(card).name, 'untouched output fields retain their values');
  assert.equal(JSON.stringify(card), original, 'edits never mutate the source');
  assert.equal(JSON.stringify(output), outputSnapshot, 'drafts never mutate the model result');
  assert.deepEqual(applyOutputReview(output, review), result, 'repeat validation is deterministic');
  const exportable = cardForElsewhereExport(result);
  assert.deepEqual(JSON.parse(JSON.stringify(exportable)), exportable);
  assert.deepEqual(extractPngCard(embedCardInPng(png, exportable)).card, exportable, 'PNG export and import preserve validated edits');
  assert.throws(() => applyOutputReview(output, review.slice(1)), /editable fields/);
  const invalid = structuredClone(review); invalid[0].path = ['__proto__', 'name'];
  assert.throws(() => applyOutputReview(output, invalid), /editable fields/);
  invalid[0] = { ...review[0], draft: null };
  assert.throws(() => applyOutputReview(output, invalid), /editable fields/);
  invalid[0] = { ...review[0], draft: ' ' };
  assert.throws(() => applyOutputReview(output, invalid), /non-empty name/);
  const variable = review.findIndex((field) => field.baseline.includes('{{user}}'));
  if (variable >= 0) {
    const broken = structuredClone(review); broken[variable].draft = broken[variable].draft.replace('{{user}}', 'user');
    assert.throws(() => applyOutputReview(output, broken), /Preserve/);
  }
}
const nested = await load('ccv3');
Object.assign(nested.data, { personality: 'Curious', scenario: 'Moon', mes_example: '{{char}}: Welcome', alternate_greetings: ['Hello {{user}}'], creator_notes: '' });
const nestedReview = createOutputReview(nested);
assert.ok(nestedReview.some((field) => field.path[0] === 'creator_notes' && field.draft === ''), 'existing empty text fields are editable');
assert.ok(nestedReview.every((field) => field.original === null), 'new generation never invents an original');
for (const path of ['character_book.entries.0.content', 'extensions.depth_prompt.prompt', 'alternate_greetings.0']) {
  const field = nestedReview.find((entry) => entry.path.join('.') === path);
  assert.ok(field); field.draft = `Edited ${field.draft}`;
}
const nestedResult = applyOutputReview(nested, nestedReview, { generated: true });
assert.deepEqual(nestedResult.data.extensions.regex_scripts, nested.data.extensions.regex_scripts);
const emptyGenerated = structuredClone(nestedReview);
emptyGenerated.find((field) => field.path.join('.') === 'personality').draft = '';
assert.throws(() => applyOutputReview(nested, emptyGenerated, { generated: true }), /must not be empty/);
const completed = mergeCompletedCard(nested, { name: 'New name', description: 'New description', personality: 'New personality', scenario: 'New scenario', first_mes: 'Hello {{user}}', mes_example: '{{char}}: Hello', extensions: { technicalId: 'changed' } });
assert.equal(completed.data.name, 'New name');
assert.deepEqual(completed.data.extensions, nested.data.extensions, 'completion retains technical metadata and unsupported structure');
assert.deepEqual(completed.data.character_book, nested.data.character_book, 'omitted lorebook remains intact');
assert.equal(createOutputReview(completed, nested)[0].original, nested.data.name);
const orderedLore = { name: 'Mira', character_book: { entries: [{ keys: ['moon'], content: 'Moon lore' }, { keys: ['sun'], content: 'Sun lore' }] } };
const reorderedLore = { name: 'Mira', character_book: { entries: [{ keys: ['sun'], content: 'Edited sun lore' }, { keys: ['moon'], content: 'Edited moon lore' }] } };
assert.throws(() => mergeCompletedCard(orderedLore, reorderedLore), /completed lorebook/);
assert.equal(orderedLore.character_book.entries[0].content, 'Moon lore');

const originalCharacter = {
  chaId: 'synthetic-review', name: 'Mira', desc: 'A **calm** guide for {{user}}.\nA second line.',
  personality: 'Kind', scenario: 'Moon', firstMessage: 'Hello {{user}}', exampleMessage: '{{char}}: Welcome',
  creatorNotes: 'Synthetic fixture', systemPrompt: 'Stay kind', postHistoryInstructions: 'Stay calm',
  alternateGreetings: ['Good evening', 'Welcome back'], globalLore: [{ key: 'moon', content: 'Bright moon', comment: 'Moon', extentions: { prompt: 'Guide {{user}}', technicalId: 7 } }],
};
const characterCard = toTranslatableCard(originalCharacter);
const characterFields = collectTranslatableFields(characterCard);
const baseline = applyTranslations(characterCard, characterFields, translatedFields(characterFields));
const characterReview = createOutputReview(baseline, characterCard);
characterReview.find((field) => field.path[0] === 'description').draft = 'An **edited** guide for {{user}}.\nA second line.';
characterReview.find((field) => field.path.join('.') === 'alternate_greetings.1').draft = 'Edited greeting';
const reviewedCard = applyOutputReview(baseline, characterReview);
let saved;
const save = createConfirmedSave({ getCharacter: async () => originalCharacter, setCharacter: async (value) => { saved = value; } }, originalCharacter, reviewedCard);
assert.equal(saved, undefined, 'preparing a save does not persist anything');
await save();
assert.equal(saved.desc, 'An **edited** guide for {{user}}.\nA second line.', 'confirmed save uses the validated edit and formatting');
assert.equal(saved.alternateGreetings[1], 'Edited greeting');
assert.notEqual(saved.personality, originalCharacter.personality, 'other translated choices are saved independently');
assert.equal(saved.globalLore[0].comment, 'Translated: Moon', 'selected lorebook names are applied in the host');
assert.equal(saved.globalLore[0].extentions.prompt, 'Translated: Guide {{user}}', 'nested supported extension text is applied in the host');
const modifiedMetadata = structuredClone(reviewedCard);
modifiedMetadata.data.character_book.entries[0].extensions.technicalId = 999;
assert.equal(applyTranslatableCard(originalCharacter, modifiedMetadata).globalLore[0].extentions.technicalId, 7, 'host save ignores changes to unsupported extension metadata');
const sparseCompletion = structuredClone(reviewedCard);
delete sparseCompletion.data.character_book.entries[0].name;
delete sparseCompletion.data.character_book.entries[0].extensions;
const completedCharacter = applyTranslatableCard(originalCharacter, sparseCompletion);
assert.equal(completedCharacter.globalLore[0].comment, originalCharacter.globalLore[0].comment, 'generation without optional lorebook name preserves the host value');
assert.deepEqual(completedCharacter.globalLore[0].extentions, originalCharacter.globalLore[0].extentions, 'generation without optional extensions preserves metadata');
sparseCompletion.data.character_book.entries[0].name = 123;
assert.throws(() => applyTranslatableCard(originalCharacter, sparseCompletion), /lorebook name is invalid/);
sparseCompletion.data.character_book.entries[0].name = 'Moon';
sparseCompletion.data.character_book.entries[0].extensions = null;
assert.throws(() => applyTranslatableCard(originalCharacter, sparseCompletion), /lorebook extensions are invalid/);
assert.equal(saved.globalLore[0].extentions.technicalId, 7, 'nested technical metadata stays unchanged');
assert.equal(originalCharacter.personality, 'Kind', 'host source fixture stays immutable');


const emptyPromptHost = structuredClone(originalCharacter);
emptyPromptHost.globalLore[0].extentions.prompt = '';
const emptyPromptCard = toTranslatableCard(emptyPromptHost);
const emptyPromptReview = createOutputReview(emptyPromptCard);
emptyPromptReview.find((field) => field.path.join('.') === 'character_book.entries.0.extensions.prompt').draft = 'Edited prompt';
assert.equal(applyTranslatableCard(emptyPromptHost, applyOutputReview(emptyPromptCard, emptyPromptReview)).globalLore[0].extentions.prompt, 'Edited prompt', 'new text in previously empty supported extensions reaches the host');

const sparseHost = { chaId: 'sparse-edit', name: 'Mira', globalLore: [{ key: 'moon' }] };
const sparseCard = toTranslatableCard(sparseHost);
const sparseReview = createOutputReview(sparseCard);
sparseReview.find((field) => field.path.join('.') === 'creator_notes').draft = 'Edited creator notes';
sparseReview.find((field) => field.path.join('.') === 'character_book.entries.0.name').draft = 'Moon lore';
sparseReview.find((field) => field.path.join('.') === 'character_book.entries.0.content').draft = 'Edited lore';
const sparseSaved = applyTranslatableCard(sparseHost, applyOutputReview(sparseCard, sparseReview));
assert.equal(sparseSaved.creatorNotes, 'Edited creator notes');
assert.equal(sparseSaved.globalLore[0].comment, 'Moon lore');
assert.equal(sparseSaved.globalLore[0].content, 'Edited lore');
assert.equal(Object.hasOwn(sparseSaved, 'desc'), false, 'untouched empty defaults remain absent in the host');

console.log('Native editable review, protected variables, nested/empty fields and PNG round trips validated.');

const roleCard = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'Nova', description: '__ELS_CHAR_PLACEHOLDER__ meets __ELS_USER_PLACEHOLDER__.', personality: 'Kind to {{ USER }}.', scenario: 'A garden.', first_mes: 'Welcome {{char}} and {{user}}.', mes_example: '__ELS_CHAR_PLACEHOLDER__: Welcome.' } };
const normalizedRoles = parseGeneratedCardResponse(JSON.stringify(roleCard));
assert.equal(normalizedRoles.data.name, 'Nova'); assert.equal(normalizedRoles.data.description, '{{char}} meets {{user}}.');
assert.equal(normalizedRoles.data.personality, 'Kind to {{ USER }}.', 'Existing literal macro spelling stays unchanged');
const completedRoles = structuredClone(normalizedRoles); completedRoles.data.description = 'Nova meets {{user}}.';
assert.throws(() => mergeCompletedCard(normalizedRoles, completedRoles), /Preserve/);
completedRoles.data.description = '{{char}} and {{char}} meet {{user}}.';
assert.equal(mergeCompletedCard(normalizedRoles, completedRoles).data.description, completedRoles.data.description, 'Additional valid role references are allowed without expanding source macros');
assert.equal(normalizedRoles.data.name, 'Nova', 'No blind name substitution');
const macroFields = collectTranslatableFields(normalizedRoles); const macroBatch = createBatches(macroFields).flat();
const preserved = applyTranslations(normalizedRoles, macroFields, parseBatchResponse(JSON.stringify(Object.fromEntries(macroBatch.map(field => [field.id, 'Translated: '+field.text]))), macroBatch));
assert.ok(preserved.data.description.includes('{{char}}')); assert.ok(preserved.data.description.includes('{{user}}'));
const { buildGenerationPrompt, buildGenerationRecoveryPrompt } = await import('../prompts.js');
for (const prompt of [buildGenerationPrompt('A librarian'), buildGenerationPrompt('Keep quoted names literally', 'complete', normalizedRoles), buildGenerationRecoveryPrompt('{}', 'A librarian')]) {
 assert.ok(prompt.includes('__ELS_CHAR_PLACEHOLDER__')); assert.ok(prompt.includes('real character name in data.name')); assert.ok(prompt.includes('explicitly asks to keep literally'));
}
console.log('Role macros preserved in translation/completion and generated token normalization; names retained.');

for (const name of ['__ELS_CHAR_PLACEHOLDER__', '{{char}}', '{{user}}']) {
 const invalidName = structuredClone(roleCard); invalidName.data.name = name;
 assert.throws(() => parseGeneratedCardResponse(JSON.stringify(invalidName)), /real name/);
}

const { buildPortraitPrompt, responseProblemHint } = await import('../prompts.js');
for (const brief of ['Moon librarian', 'Add the word HELLO on a sign', 'Une affiche avec le texte Bonjour', '文字入りのポスター']) { const prompt = buildPortraitPrompt(brief); assert.ok(prompt.includes(brief)); assert.match(prompt, /unless the user explicitly requests/); assert.match(prompt, /only the requested text/); }
assert.match(responseProblemHint(''), /no final text/); assert.match(responseProblemHint('<think>Reasoning</think>'), /reasoning without/); assert.match(responseProblemHint('{"data":'), /incomplete or did not match/);
assert.ok(!buildGenerationPrompt('A librarian').includes('"data":{...}'));

const visualBrief = "C'et pas un humain c'est un cucurbitacé";
const visualPrompt = buildPortraitPrompt(visualBrief);
assert.ok(visualPrompt.includes(visualBrief)); assert.match(visualPrompt, /instructions describe the desired visual/); assert.match(visualPrompt, /not a caption or text to render/); assert.match(visualPrompt, /Never quote, transcribe, engrave/); assert.match(visualPrompt, /remove or omit any reference lettering/);
assert.ok(buildPortraitPrompt('Grave exactement BONJOUR sur une plaque').includes('Grave exactement BONJOUR sur une plaque')); assert.match(buildPortraitPrompt('Grave exactement BONJOUR sur une plaque'), /unless the user explicitly requests those exact words/);
