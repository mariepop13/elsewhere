import { expect, test, vi } from 'vitest'
import { parseGeneratedCardResponse, mergeCompletedCard, createOutputReview, applyOutputReview, createBatches, collectTranslatableFields, parseBatchResponse } from './cardCore.js'
import { buildGenerationRecoveryPrompt } from './prompts.js'
import { ElsewordsSession } from './session.svelte'
const card = () => ({ spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'DemoHorse', description: '{{char}} walks with {{user}}.', personality: 'Calm', scenario: 'A meadow', first_mes: 'Hello {{user}}', mes_example: '{{char}}: Hello', extensions: { keep: true } } })
const valid = () => JSON.stringify(card())
const malformed = () => '<Thoughts>synthetic-discard-marker</Thoughts>' + valid().replace(',"personality":', ',personality":').replace(',"scenario":', ',scenario":')
test('tagged reasoning is discarded independently from final JSON validity', () => {
 expect(parseGeneratedCardResponse('<Thoughts>synthetic-discard-marker</Thoughts>'+valid()).data.name).toBe('DemoHorse')
 expect(() => parseGeneratedCardResponse(malformed())).toThrow(/not valid JSON/)
 expect(() => parseGeneratedCardResponse('<Thoughts>'+valid())).toThrow(/not valid JSON/)
 expect(() => parseGeneratedCardResponse('<Thoughts>synthetic-discard-marker</think>'+valid())).toThrow(/not valid JSON/)
})
test('single recovery receives final malformed answer, explicit quoted schema and distinct required macros', () => {
 const source = card(); source.data.description += ' {{char}} rests.'
 const prompt = buildGenerationRecoveryPrompt(malformed(), 'Rewrite as a horse', 'complete', source)
 expect(prompt).not.toContain('synthetic-discard-marker')
 expect(prompt).toContain('double quotes around EVERY key')
 expect(prompt).toContain('Correct malformed key quoting')
 expect(prompt).toContain('"field":"description","macros":["{{char}}","{{user}}"]')
 expect(prompt).toContain('personality":')
})
test('completion can reduce repetitions while preserving each role and source metadata', () => {
 const source = card(); source.data.description += ' {{char}} rests.'; source.spec='chara_card_v2'; source.spec_version='2.0'
 const before = JSON.stringify(source), completed = mergeCompletedCard(source, card())
 expect(completed.data.description).toBe(card().data.description)
 expect(completed.spec).toBe('chara_card_v2'); expect(completed.data.extensions).toEqual({keep:true})
 expect(JSON.stringify(source)).toBe(before)
})
test.each(['{{char}} rests.', '{{user}} rests.', '{{Char}} walks with {{user}}.'])('completion rejects missing or changed required roles: %s', description => {
 const candidate=card(); candidate.data.description=description
 expect(() => mergeCompletedCard(card(),candidate)).toThrow(/Preserve/)
})
test('generated edits can change repetition; translated edits remain occurrence-exact', () => {
 const output=card(); output.data.description+=' {{char}} rests.'
 const review=createOutputReview(output); review.find(f=>f.path.join('.')==='description')!.draft=card().data.description
 expect(applyOutputReview(output,review,{generated:true}).data.description).toBe(card().data.description)
 expect(()=>applyOutputReview(output,review)).toThrow(/Preserve/)
 const batch=createBatches(collectTranslatableFields(output)).flat()
 const response=Object.fromEntries(batch.map(f=>[f.id,f.text])); const protectedField=batch.find(f=>f.tokens.length)!; response[protectedField.id]=protectedField.text.replace(/⟦EW\d+⟧/,'')
 expect(()=>parseBatchResponse(JSON.stringify(response),batch)).toThrow()
})
test('legacy sentinels and exact custom macro spelling remain protected', () => {
 const source=card(); source.data.description='__ELS_CHAR_PLACEHOLDER__ sees __ELS_USER_PLACEHOLDER__. {{ custom }} {{ custom }}'
 const candidate=card(); candidate.data.description='{{char}} greets {{user}}. {{ custom }}'
 expect(mergeCompletedCard(source,candidate).data.description).toBe(candidate.data.description)
 candidate.data.description='{{char}} greets {{user}}. {{custom}}'
 expect(()=>mergeCompletedCard(source,candidate)).toThrow(/Preserve/)
 const legacy=card(); legacy.data.description='__ELS_CHAR_PLACEHOLDER__ greets __ELS_USER_PLACEHOLDER__.'
 expect(parseGeneratedCardResponse(JSON.stringify(legacy)).data.description).toBe(card().data.description.replace('walks with','greets'))
})
test('malformed placeholder braces and multiple final cards are rejected', () => {
 const candidate=card();candidate.data.description='{{char} walks with {{user}}.'
 expect(()=>parseGeneratedCardResponse(JSON.stringify(candidate))).toThrow(/malformed/)
 expect(()=>parseGeneratedCardResponse(valid()+'\n'+valid())).toThrow(/not valid JSON/)
})
function fixture(responses: string[]) {
 const request=vi.fn(async(_prompt: string, _signal?: AbortSignal)=>responses.shift()!),write=vi.fn()
 const host={modelIdentity:()=> 'synthetic',request,setCharacter:write,create:write,selected:()=>null,characters:()=>[]}
 const session=new ElsewordsSession(host as any,{getItem:()=>null,setItem:()=>{}} as any)
 session.mode='complete';session.card=card();session.card.data.description+=' {{char}} rests.';session.brief='Rewrite as a horse'
 return {session,request,write}
}
test('real session recovers once from malformed keys and accepts lower macro count without applying', async()=>{
 const {session,request,write}=fixture([malformed(),valid()]);const before=JSON.stringify(session.card)
 await session.generate()
 expect(session.error).toBe('');expect(session.output?.data.name).toBe('DemoHorse');expect(request).toHaveBeenCalledTimes(2);expect(write).not.toHaveBeenCalled()
 expect(JSON.stringify(session.card)).toBe(before)
 expect(JSON.stringify(session.debug)).not.toContain('synthetic-discard-marker')
 expect(request.mock.calls[1][0]).not.toContain('synthetic-discard-marker')
 const draft=session.review.find(f=>f.path.join('.')==='description')!;draft.draft='__ELS_CHAR_PLACEHOLDER__ greets __ELS_USER_PLACEHOLDER__.';session.updatePreview();expect(draft.draft).toBe('{{char}} greets {{user}}.');expect(draft.translation).toBe(draft.draft);expect(request).toHaveBeenCalledTimes(2)
})
test('two failed outputs retain previous output, never write and never retry again',async()=>{
 const {session,request,write}=fixture([valid()]);await session.generate();const previous=JSON.stringify(session.output)
 request.mockImplementation(async()=>malformed());await session.generate()
 expect(request).toHaveBeenCalledTimes(3);expect(session.error).toContain('automatic retry failed');expect(JSON.stringify(session.output)).toBe(previous);expect(write).not.toHaveBeenCalled()
})

test.each(['{{}}', '{{   }}', '{{{char}}}', '{{char}}}'])('rejects malformed role syntax: %s', description=>{ const candidate=card(); candidate.data.description=description; expect(()=>parseGeneratedCardResponse(JSON.stringify(candidate))).toThrow(/malformed/) })
test('generated review normalizes actual sentinel output and rejects sentinel names',()=>{
 const output=card(),review=createOutputReview(output);review.find(f=>f.path.join('.')==='description')!.draft='__ELS_CHAR_PLACEHOLDER__ greets __ELS_USER_PLACEHOLDER__.'
 expect(applyOutputReview(output,review,{generated:true}).data.description).toBe('{{char}} greets {{user}}.')
 review.find(f=>f.path.join('.')==='name')!.draft='__ELS_CHAR_PLACEHOLDER__'
 expect(()=>applyOutputReview(output,review,{generated:true})).toThrow(/real name/)
})
