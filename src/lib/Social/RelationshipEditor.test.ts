import { expect, it } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import RelationshipEditor from './RelationshipEditor.svelte';
import type { RelationshipView } from '../../ts/social/relationshipLedger';
import type { ExplicitRelationshipCommand } from '../../ts/social/relationshipEventAdapter';

it('retries the exact acknowledged-late initialization after the visible baseline changes', async () => {
    const a = { kind: 'persona' as const, id: 'persona-a' }, b = { kind: 'character' as const, id: 'character-b' };
    const view: RelationshipView = { relation: { worldId: 'world', subject: a, other: b }, scores: { familiarity: null, trust: null, affinity: null, tension: null }, description: '', events: [] };
    const target = document.createElement('div'); document.body.append(target);
    const calls: ExplicitRelationshipCommand[] = []; let ids = 0;
    const component = mount(RelationshipEditor, { target, props: { view, source: { kind: 'authored_note', saveId: 'save', worldId: 'world', ownerId: 'owner', recordId: 'note', participants: [a, b] }, scope: 'private', knownBy: [a, b], createCommandId: () => `command-${++ids}`, oncommand: command => {
        calls.push(structuredClone(command));
        view.scores.trust = 35;
        if (calls.length === 1) throw new Error('Acknowledgement failed after recording');
    } } });
    try {
        flushSync(); await tick(); expect(ids).toBe(0); expect(calls).toHaveLength(0);
        const input = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string, type = 'input') => {
            element.value = value; element.dispatchEvent(new Event(type, { bubbles: true })); flushSync();
        };
        input(target.querySelector('select'), 'relationship.initialized', 'change');
        input(target.querySelectorAll('input')[1], '35');
        input(target.querySelectorAll('textarea')[1], 'Chosen starting trust');
        const submit = async () => { target.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick(); flushSync(); };
        await submit(); expect(calls).toHaveLength(1); expect(target.textContent).toContain('Acknowledgement failed');
        await submit(); expect(calls).toHaveLength(2); expect(ids).toBe(1); expect(calls[1]).toEqual(calls[0]);
        expect(target.textContent).toContain('Interaction recorded');
    } finally { await unmount(component); target.remove(); }
});
