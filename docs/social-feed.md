# Optional social feed

Open **Social feed** from the desktop rail or mobile navigation, then enable the mode. Pausing preserves its publications, cast and public profiles. Returning to chats cancels pending generation.

## First version

Open **My universe** to choose up to four existing character cards, write a public profile for each, and optionally describe the public world. The four-character limit bounds this first version's request cost; it is not a permanent product limit. Post using the current persona or another persona's display identity. Publishing is local and never calls a model. Likes are local too.

The universe settings start collapsed. **What’s new?** opens the compact composer; closing it or pressing Escape keeps the draft and returns focus to its trigger. Character-card portraits and persona icons reuse existing assets and respect the application’s image visibility setting. The help button contains privacy and cost details, plus pause; Escape closes help and returns focus to the button.

Select **Ask cast to react** on a publication to ask each eligible character whether to react or comment. Characters may decline without a public response. Actors already represented by a response or decline on that publication are skipped. A batch is saved atomically, so an error preserves the post and allows an explicit retry. Cancel, leaving the screen, editing public profiles, pausing, deleting a post or replacing the database invalidates pending results. Cancelling cannot guarantee that a provider has stopped processing an already-sent request.

The current implementation supports OpenAI-compatible, Anthropic and Gemini chat transports, including custom proxies using one of these formats. Other transports display an explanation. It uses the selected chat model with a bounded output and normal provider costs, without background simulation, client retries, fallback chains or tools.

## Public and private facts

Card IDs, names and images are reused for identity. Public profiles are written explicitly. Card descriptions, persona prompts, chat history, private memory, lore, global notes, chat scripts and plugin prompt extensions are excluded from generation. The public prompt contains the chosen actor's public profile, public world, publication and its existing public comments. Public generation bypasses configurable system-message replacements, prediction content, global schemas, instruct templates, additional body parameters and transport interceptors.

Posts snapshot their author identity; character responses snapshot the actor identity. Stable character IDs and public interaction history prepare later relationships without implementing scoring, reputation, events, followers, aura or progression.

`Database.socialFeed` is optional for old saves and initialized on first entry. Existing autosave and full database backups include this root field. Character-card export does not carry the feed.

## Local acceptance

From this worktree, with existing dependencies:

```sh
VITE_ELSEWHERE_USAGE_MODE=private-local node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 6620 --strictPort
```

Use a separate browser profile and fictional cards/personas. Provider responses must be intercepted with local fixtures, never real credentials or paid calls.

1. Enable the mode, add characters and enter public profiles/world. Publish a post. Expected: no model request.
2. Request reactions, like the post and repeat the request. Expected: one decision per eligible actor and no duplicate generation; declines create no public response.
3. Cancel a delayed request, then leave/reopen the feed during a delayed request. Expected: no late responses are saved.
4. Return a fixture error and explicitly retry. Expected: the post survives; a successful retry adds the complete batch.
5. Pause/re-enable, leave/reopen and reload after autosave. Expected: publications, reactions and public profiles remain.
6. Check widths 390px and 320px, expand/collapse the cast and use deletion confirmation. Expected: usable controls without horizontal overflow.
7. Open the composer with Enter, type a draft, press Escape from the textarea and other composer controls, then reopen. Expected: retained draft and restored focus. Open help with Enter and close with Escape. Check existing portraits and missing-image fallback.
8. Replace the database with an old save without `socialFeed` while the screen is open. Expected: safe disabled initial state.

Runtime evidence is recorded in `plans/PLAN-social-feed.md`. Native Tauri, real model quality and real-provider billing are outside this fixture-only validation.


## Temporary private preview

The current test build uses an explicitly authorized exact-origin `private-preview` mode for HTTPS8443. It retains a separate source notice, uses its own save, initially seeded with fictional data and a deterministic localhost provider fixture, and does not accept third-party contracts. The initial fixture demonstrates request behavior, not model quality. It is not forced: the feed always uses the currently selected chat model. User-entered provider settings are preserved. Existing443 and browser-origin data are preserved. Prefer a private window; in the classic mobile layout open the top-left sidebar arrow, then Social feed. The runtime remains available until the user explicitly finishes testing. Its ownership-checked cleanup script stops only its route/processes and preserves saves. Remove this temporary origin configuration after the trial before future PR delivery.


## User-configured generation

Select **Model settings** in the feed to open **Settings → Chat Bot → Model**. The selected model name appears in the feed. In the classic layout, close settings to return to the feed. In the mobile navigation layout, tap Social feed in the footer to return. Publications and cast are kept.

Choose a main model using an OpenAI-compatible chat-completions, Anthropic or Gemini format and enter the corresponding provider settings yourself. For **Custom API**, replace the demo localhost URL with your provider's endpoint, set **Request Model** to its model identifier, choose **OpenAI Compatible**, **Anthropic Claude** or **Google Cloud** format, and enter its **Key/Password** only when needed. OpenAI Responses API and other formats are not supported by this first social slice. An endpoint using localhost refers to the preview server, not the phone.

Provider keys and other database settings are saved in this Node preview server's save directory. Reactions send only the public world, public actor profiles, the selected publication and its public comments to the configured provider. Normal provider charges apply when the user explicitly requests reactions. Publishing your own text and likes remain local; generating a character publication is an explicit provider request. There is no forced fixture, background generation or agent-triggered live model test.

Return to Social feed, open **My universe**, select characters and write their public personalities/known facts. Publish a new post and select **Ask cast to react**. Previously completed cast responses are not regenerated; use a new publication to test a changed model. Cancellation and errors keep the publication.


## Failed reaction diagnostics

The feed distinguishes a failed request, invalid social JSON, an incomplete model response and empty final text. It retains the publication and saves no partial batch. A status number is a request-layer status; some client/network failures use a synthetic status. Error messages never quote raw provider bodies or keys. Open help → **Request diagnostics** to inspect the existing redacted in-memory logs without generating again. Refreshing the browser clears those logs.

For OpenRouter, the selected request model identifier is shown in the feed. The social response limit is shared by the whole cast and displayed in Generation settings; its initial value is320 tokens. On reasoning-capable providers this may include thinking tokens; it can be insufficient for a final response. A truncated response diagnostic establishes that category for the new request, but a generic older failure does not. No automatic retry, model substitution or budget increase occurs.


## Thinking and output budget

Public reactions use only the provider’s final text. Structured reasoning, Anthropic thinking blocks and Google thought parts are excluded before the private-chat formatter. Known thinking markers in final content or decoded JSON comments are rejected; the application does not repair thought blocks or extract JSON from reasoning. Unmarked reasoning placed directly in final content cannot be identified reliably. Private-chat thinking display and provider reasoning settings are unchanged.

The initial320-token response limit is a first-slice application choice (`DEFAULT_SOCIAL_RESPONSE` in `src/ts/social/socialLimits.ts`), not a validated GLM recommendation. It applies per requested actor, at most four actors (1,280 requested output tokens for a full initial batch). Reasoning and final text commonly share that cap. The600-character comment validator is separate and reserves no final-answer tokens. Input tokens/provider routing/pricing also affect billing. Generation settings now lets the user explicitly edit one common social response limit; it is independent of chat settings and is never escalated automatically.


## Common social generation settings

Open **Generation settings** in the feed. **Max Context Size** and **Max Response Size** are saved once for the social casting, independent of the same-named private-chat parameters. The closed summary shows both values. Existing saves without these fields receive visible initial values4,000 context/320 response; existing selected values and publications are retained. The screenshot8,000/1,200 is not an imposed default.

Context accepts whole numbers512–131,072. Response accepts64–8,192 and must be smaller than context. These are application boundaries, not recommended/model-guaranteed limits. Invalid or blank limits block generation; no silent clamping, model change or retry occurs. Response includes thinking and final reply where the provider shares that allowance; the final comment still has its separate600-character validator.

Before any actor is requested, all eligible actors' public prompts are counted with bundled local cl100k tokenization, including role/framing allowance and the full selected response reserve. This is an estimate; provider counts can differ. It never uses provider countTokens, plugin tokenizers or remote tokenizer downloads. If any estimated context exceeds the selected limit, the whole batch stops before any request, preserving the post. Shorten public facts or explicitly adjust social limits; the application does not quietly reduce individual actors' response allowances.

The maximum batch output displayed beside a post is response limit × eligible actor count (at most four); already completed actors are excluded. Generation settings also shows the maximum for the selected casting. Input tokens, model pricing and provider-side routing additionally affect charges; this token display is not a monetary cap. Changing limits, author, public comments or public facts while a batch is pending discards late responses. The same public DTOs are used for preflight and requests; private chats/persona prompts/memory/templates/tools stay excluded.


## Invalid final JSON diagnostics

A successful HTTP response does not guarantee a valid public reaction. The feed now reports a safe specific category: final text not JSON; final JSON not one object; reaction not exactly like/love/curious/none; comment not a string; comment longer than600 characters; invalid publication text; duplicate publication; or thinking markers in final content. It never displays raw model text as an error or saves an invalid/partial batch. These diagnostics do not increase a budget, substitute a model, retry, or weaken thinking/private-context guards.

The social instruction gives one valid JSON example and lists the allowed reaction values separately. It remains a prompt contract, not a provider-enforced response schema: private-chat schema settings are deliberately excluded. No arbitrary JSON is rescued from prose or reasoning.

For an existing attempt, on the same device and browser tab, open **Social feed → ? (About the feed) → Request diagnostics**. The **Show Request Logs** dialog lists routing metadata; click the relevant OpenRouter chat-completions row to see its time/status/URL. Request and response content are deliberately omitted (`[Request content omitted]`, `[Response content omitted]`), so the final JSON, finish_reason and validation reason cannot be recovered there. The journal is in browser memory, not shared between Android/Windows tabs, and disappears after reload/closure. No DevTools are needed to view this UI journal. New granular errors cannot be retroactively reconstructed from the old omitted response. Do not regenerate just to collect diagnostics; no additional model call is authorized.


## Per-character limit, not a shared token pool

**Each character request gets the full selected social context and response limits. Neither is divided by cast size.** One common setting means the same value for every character, not a shared allowance. The total displayed for cost information is response limit × number of eligible characters.

For context8,000 / response4,000 with four characters: each request has its own8,000 context ceiling (public prompt plus output reservation) and its own4,000 response ceiling; total possible output is16,000. Context is checked independently per public prompt, not summed across the casting. If the user explicitly selects a response limit8,000, each character gets8,000 output and four characters total32,000; the context setting must be larger than response to leave prompt space. This is an explanation, not a change to user settings or a recommendation to increase them.

Preferred concise wording: "Same limits per character request; never divided between characters." Total wording: "Combined possible output — cost information only." Application code is already correct; this clarification changes documentation and regression assertions only, keeping the running preview unchanged.


## Manual character publications and selective reactions

Choose an actor under **Let a character post**, then **Generate character post**. This makes one request using their explicitly written public profile, public world and at most eight recent public posts/comments. It creates one attributed publication, without automatically requesting reactions. **Ask cast to react** remains a separate manual action. The author is excluded from their own reaction batch. Each request receives the full common social limits, without dividing a pool. The UI shows the maximum output; input and provider pricing also affect cost.

A reaction of `none` with an empty comment is an explicit decline. It is persisted in optional `SocialPost.consideredActorIds`, without inventing a public response. Existing `none` responses with comments remain valid. Optional `SocialAuthor.characterId` identifies character publications without inferring attribution from display names or persona IDs. Old saves require no destructive migration. Responses and decline decisions are saved atomically, and each actor is considered once per post. Changing the cast permits newly added actors to be requested. There is no automatic retry, timer, background simulation or paid follow-up chain. An explicit retry after a failed batch can repeat already attempted provider requests.

Publication output must be a complete JSON object with non-empty `text` of at most 2000 characters. Thinking-tag checks apply before and after decoding. Exact normalized duplicates of existing posts are rejected without retry. Public data is reprojected at the prompt boundary; private chats, card descriptions, persona prompts, memory, tools and plugins remain excluded. The selected model identity and DB identity are checked before saving. Cancellation or public context/budget changes discard late results. An already submitted provider request may still be charged after cancellation. Dynamic model-capability integration is independently owned and not included in this continuation.


## Automatic public language

The existing model request includes a structured, public-only language policy. Reactions first follow the clear main language of their target post, then the recent user's discussion in this feed, then the public world/profiles, and only finally the actual supported interface language. Character publications have no target post and use the remaining priorities. English-written profiles do not override a clear French target or French user discussion. Short names, emoji, numbers, quotes and borrowed words are weak cues; ambiguous tiers fall through to the next, and mixed-language context asks for the main relevant conversational language. JSON keys/reaction identifiers stay unchanged. This is a model instruction, not guaranteed language detection or a language classifier service.

Language cues contain at most five recent user-authored post excerpts (400 characters each) and four explicit public-profile excerpts (400 each). Character-authored posts do not count as user-language signals. The existing app has one persisted social world/feed; no private chat or other universe is consulted. The full public prompt, including cues, is measured by the existing token preflight, without dividing the shared per-request output allowance or making another model call. Relevant cue changes cancel stale batches, and interface language is captured for the entire request. Existing saved posts, profiles and limits are not rewritten; there is no new language setting to migrate.


## Public relationships

Open **Public relationships** to inspect the participants, familiarity and actual public exchange history, newest first, with older exchanges available via **Show older exchanges** and a **View source post** action. Familiarity counts distinct public threads with saved character reactions/comments: one is first contact, two or three are getting acquainted, four or more are familiar faces. It measures contact, not affection/trust/hostility/romance. Character personality and the actual dialogue still determine the relationship's tone. A heart alone does not create a romantic bond. Declines have no relationship effect.

The source of truth is existing saved public responses and explicitly attributed post authors, grouped by stable persona/character IDs. There is no writable score ledger or hidden past to migrate. Responses are deduplicated by actual event IDs; multiple events in one thread do not inflate familiarity, and reloading/repeating requests cannot double-apply anything. Failed/cancelled atomic batches leave no saved public evidence and therefore no relationship changes. Deleting a post removes its contribution, as the panel explains. Anonymous user-like toggles have no saved actor identity, so they do not invent past relationship events.

For generation, at most three relevant contacts with two recent interactions each are passed, using public name/identity, contact stage/count, reaction, and post/comment excerpts capped at240 characters. The transport reprojects these fields and counts the complete prompt using the existing budgets. No extra model call analyzes relationships. Private chats, memories, card/persona prompts and lore remain excluded. Relevant public history changes invalidate late generation via the same snapshots used for preflight. This slice does not add reputation, followers, events or background simulation.


Current and explicitly selected persona choices now use the same stable persona ID for newly published posts while preserving their existing public display names/images. Legacy index-based author snapshots are not rewritten or guessed from names, so ambiguous old aliases can remain separate history entries. Reaction context prioritizes the target author's relationship within the three-contact budget; older relevant history is not displaced by unrelated recent contacts.
