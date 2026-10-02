import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyTranslations, cardData, cardExportFilename, cardForElsewhereCreation, cardForElsewhereExport, collectTranslatableFields, createBatches, embedCardInPng, extractPngCard, parseBatchResponse, parseGeneratedCardResponse, protectText, restoreText } from '../cardCore.js';

const load = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

for (const name of ['ccv2', 'ccv3', 'sillytavern']) {
  const card = await load(name);
  const fields = collectTranslatableFields(card);
  assert.ok(fields.length > 0, `${name} has translatable fields`);
  const batches = createBatches(fields, 500);
  const response = JSON.stringify({ translations: batches.flat().map((field) => ({ id: field.id, text: field.text })) });
  const translations = parseBatchResponse(response, batches.flat());
  const translated = applyTranslations(card, fields, translations);
  assert.deepEqual(translated, card, `${name} preserves its complete structure when text is unchanged`);
}

const ccv2 = await load('ccv2');
assert.ok(collectTranslatableFields(ccv2).some((field) => field.path.join('.') === 'alternate_greetings.0'));
const ccv2Wrapper = { spec: 'chara_card_v2', spec_version: '2.0', data: ccv2 };
assert.equal(cardData(ccv2Wrapper).name, 'Mira of the Moon', 'standard CCv2 wrappers use their data object');
const elsewhereReady = cardForElsewhereExport(ccv2Wrapper);
assert.deepEqual(elsewhereReady.data.extensions, {}, 'Elsewhere-importable CCv2 exports include the extensions object expected by its importer');
assert.equal(ccv2Wrapper.data.extensions, undefined, 'preparing an export does not mutate the staged card');
assert.equal(cardExportFilename(elsewhereReady, 'translated', 'json'), 'Mira-of-the-Moon-translated.json');
assert.throws(() => cardForElsewhereExport({ ...ccv2Wrapper, data: { ...ccv2, extensions: 'invalid' } }), /extensions must be an object/);
const ccv3 = await load('ccv3');
assert.ok(collectTranslatableFields(ccv3).some((field) => field.path.join('.') === 'extensions.depth_prompt.prompt'));
assert.deepEqual(cardForElsewhereExport(ccv3), ccv3, 'existing CCv3 extensions remain intact');
const sparseGenerated = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'Luna', description: 'A careful archivist.', personality: 'Patient', scenario: 'A library', first_mes: 'Hello', mes_example: 'Example' } };
const creatableGenerated = cardForElsewhereCreation(sparseGenerated);
assert.equal(creatableGenerated.data.name, 'Luna');
assert.deepEqual(creatableGenerated.data.character_book, { entries: [], extensions: {} });
assert.deepEqual(creatableGenerated.data.assets, []);
assert.deepEqual(creatableGenerated.data.tags, []);
assert.equal(creatableGenerated.data.creator, '');
assert.equal(sparseGenerated.data.character_book, undefined, 'creation does not mutate the reviewed card');
const creatableImported = cardForElsewhereCreation({ name: 'Imported', first_mes: 'Hello' });
assert.equal(creatableImported.spec, 'chara_card_v2', 'unwrapped imports use a supported card specification');
assert.deepEqual(creatableImported.data.alternate_greetings, []);
assert.deepEqual(cardForElsewhereCreation(ccv3).data.extensions, ccv3.data.extensions, 'creation preserves existing extensions');
assert.throws(() => cardForElsewhereCreation({ ...ccv3, data: { ...ccv3.data, character_book: { entries: 'invalid' } } }), /lorebook must contain an entries array/);

const protectedValue = protectText('**Hello**, {{user}}!\nVisit https://example.test/a.');
assert.equal(restoreText(protectedValue.protectedText, protectedValue.tokens), '**Hello**, {{user}}!\nVisit https://example.test/a.');
assert.equal(restoreText('⟦EW0⟧ Persona de ⟦EW1⟧ ; ⟦EW1⟧ Corps de ⟦EW2⟧', [{ marker: '⟦EW0⟧', value: 'A' }, { marker: '⟦EW1⟧', value: 'B' }, { marker: '⟦EW2⟧', value: 'C' }]), 'A Persona de  ; B Corps de C', 'duplicate markers are removed only when each expected marker remains in source order');
assert.throws(() => restoreText('Changed', protectedValue.tokens), /protected formatting token/);
const responseBatch = [{ id: 'f0', text: 'Hello', tokens: [] }];
assert.throws(() => parseBatchResponse('{"translations":[]}', responseBatch), /omitted/);
assert.deepEqual(parseBatchResponse(`Here is the translation:\n\`\`\`json\n{"translations":[{"id":"f0","text":"Bonjour"}]}\n\`\`\``, responseBatch), [{ id: 'f0', text: 'Bonjour' }]);
assert.deepEqual(parseBatchResponse('<think>{"analysis":"The request needs French."}</think>\n{"translations":[{"id":"f0","text":"Bonjour"}]}', responseBatch), [{ id: 'f0', text: 'Bonjour' }], 'reasoning objects do not prevent recovery of the one complete translations object');
assert.deepEqual(parseBatchResponse(JSON.stringify('{"translations":[{"id":"f0","text":"Bonjour"}]}'), responseBatch), [{ id: 'f0', text: 'Bonjour' }], 'a JSON-encoded response string is unwrapped once');
assert.deepEqual(parseBatchResponse('[{"id":"f0","text":"Bonjour"}]', responseBatch), [{ id: 'f0', text: 'Bonjour' }], 'a JSON translation array is accepted when the model omits the wrapper object');
assert.deepEqual(parseBatchResponse('{"f0":"Bonjour"}', responseBatch), [{ id: 'f0', text: 'Bonjour' }], 'an exact ID-to-text map is accepted when the model omits the wrapper object');
assert.deepEqual(parseBatchResponse('{"response":{"content":{"translations":[{"id":"f0","text":"Bonjour"}]}}}', responseBatch), [{ id: 'f0', text: 'Bonjour' }], 'a provider envelope containing one complete translation payload is unwrapped');
assert.throws(() => parseBatchResponse('{"translations":[{"id":"f0","text":"One"}]} and {"translations":[{"id":"f0","text":"Two"}]}', responseBatch), /one complete translations object, array, or ID-to-text map/);
assert.throws(() => parseBatchResponse('{"translations":[', responseBatch), /not valid JSON/);

const generatedCard = parseGeneratedCardResponse(`Generated card:\n{"spec":"chara_card_v3","data":{"name":"Luna","description":"A careful archivist.","personality":"Patient","scenario":"A library","first_mes":"Hello __ELS_USER_PLACEHOLDER__","mes_example":"{{ USER }} reads."}}`);
assert.equal(generatedCard.data.first_mes, 'Hello {{user}}');
const generatedAfterThoughts = parseGeneratedCardResponse(`<Thoughts>{"analysis":"drafting a card"}</Thoughts>\n{"spec":"chara_card_v3","data":{"name":"Luna","description":"A careful archivist.","personality":"Patient","scenario":"A library","first_mes":"Hello","mes_example":"Example"}}`);
assert.equal(generatedAfterThoughts.data.name, 'Luna', 'a closed reasoning block is discarded before the final card is parsed');
assert.equal(generatedCard.data.mes_example, '{{ USER }} reads.', 'Already literal role macros preserve their spelling.');
assert.throws(() => parseGeneratedCardResponse('{"name":"Luna","description":"A careful archivist."}'), /missing meaningful personality/);
assert.throws(() => parseGeneratedCardResponse('{"spec":"chara_card_v3","data":{"name":"Luna","description":"...","personality":"...","scenario":"...","first_mes":"...","mes_example":"..."}}'), /missing meaningful description/);
assert.throws(() => parseGeneratedCardResponse('{"name":"One"} and {"name":"Two"}'), /not valid JSON/);
const invalidCard = await load('invalid-card');
assert.throws(() => cardData(invalidCard), /non-empty name/);
assert.throws(() => cardData({ spec: 'lorebook_v3', name: 'Not a card' }), /unsupported character-card specification/);

const pngBase64 = (await readFile(new URL('./fixtures/ccv2.png', import.meta.url))).toString('base64');
const pngCard = extractPngCard(pngBase64);
assert.equal(pngCard.card.name, 'PNG Luna');
const translatedPng = embedCardInPng(pngBase64, { ...pngCard.card, description: 'Translated {{user}}.' });
assert.equal(extractPngCard(translatedPng).card.description, 'Translated {{user}}.');
const pngWithoutCardMetadata = stripCharaChunk(Buffer.from(pngBase64, 'base64')).toString('base64');
const generatedPng = embedCardInPng(pngWithoutCardMetadata, { name: 'Generated Luna', description: 'Generated description.', personality: 'Patient', scenario: 'A library', first_mes: 'Hello', mes_example: 'Example' });
assert.equal(extractPngCard(generatedPng).card.name, 'Generated Luna', 'a selected ordinary PNG receives character metadata during generated-card export');
const ccv2WrapperPng = embedCardInPng(pngWithoutCardMetadata, ccv2Wrapper);
assert.equal(extractPngCard(ccv2WrapperPng).card.data.name, 'Mira of the Moon', 'PNG chara metadata accepts standard CCv2 wrappers');
const elsewhereReadyPng = embedCardInPng(pngWithoutCardMetadata, elsewhereReady);
assert.deepEqual(extractPngCard(elsewhereReadyPng).card.data.extensions, {}, 'PNG exports include the Elsewhere-compatible card payload');
const invalidPngBase64 = (await readFile(new URL('./fixtures/invalid-card.png', import.meta.url))).toString('base64');
const invalidChecksumPngBase64 = (await readFile(new URL('./fixtures/invalid-checksum.png', import.meta.url))).toString('base64');
assert.throws(() => extractPngCard(invalidPngBase64), /not a supported character card/);
assert.throws(() => extractPngCard(invalidChecksumPngBase64), /invalid checksum/);
assert.throws(() => extractPngCard(Buffer.from('not a PNG').toString('base64')), /not a PNG/);

console.log('Synthetic card fixtures validated.');

function stripCharaChunk(bytes) {
  const chunks = [bytes.subarray(0, 8)];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    const type = bytes.subarray(offset + 4, offset + 8).toString();
    const data = bytes.subarray(offset + 8, end - 4);
    const isCardChunk = type === 'tEXt' && data.subarray(0, data.indexOf(0)).toString().toLowerCase() === 'chara';
    if (!isCardChunk) chunks.push(bytes.subarray(offset, end));
    offset = end;
  }
  return Buffer.concat(chunks);
}
