<script lang="ts">
    import { FolderCodeIcon, GlobeIcon, MailIcon, Send } from "@lucide/svelte";
    import { getVersionString, openURL } from "src/ts/globalApi.svelte";

    type RelatedLink = {
      title: string;
      description: string;
      href: string;
      logoIcon: "source" | "globe" | "mail" | "paper-airplane";
    };

    const relatedLinkIconClass =
      "h-40 w-40 md:h-44 md:w-44 origin-right -rotate-12 opacity-[0.12] transition-all duration-500 group-hover:scale-105 group-hover:opacity-[0.22]";

    const relatedLinks: RelatedLink[] = [
      {
        title: "Elsewhere on GitHub",
        description: "View the source code and contribute to Elsewhere.",
        href: "https://github.com/mariepop13/elsewhere",
        logoIcon: "source"
      },
      {
        title: "Upstream RisuAI",
        description: "View the original project and its contributors.",
        href: "https://github.com/kwaroran/RisuAI",
        logoIcon: "source"
      }
    ];
</script>
<div class="main-menu-shell h-full w-full flex flex-col overflow-y-auto items-center">
    <header class="main-menu-hero">
      <div class="main-menu-hero-top">
        <span class="main-menu-brand" aria-label="Elsewhere">ELSE<span>//</span>WHERE</span>
        <span class="main-menu-version">Version {getVersionString()}</span>
      </div>
      <div class="main-menu-hero-copy">
        <h1>Ready for a new story?</h1>
        <p>Choose a character from the sidebar or add one to begin.</p>
      </div>
      <div class="main-menu-orbit" aria-hidden="true"><span>//</span></div>
      <div class="main-menu-track" aria-hidden="true"><span></span></div>
    </header>
    <div class="w-full flex px-4 pb-8 pt-7 flex-col text-textcolor max-w-4xl">
      <h2 class="text-2xl font-bold mb-4">
        Related Links
      </h2>
        <div class="grid w-full grid-cols-1 gap-4 p-2 md:grid-cols-2">
          {#each relatedLinks as relatedLink}
            <button class="group relative flex min-h-[140px] flex-col justify-center overflow-hidden rounded-2xl border border-borderc/10 bg-darkbg p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-borderc/30 hover:bg-selected/50 hover:shadow-xl hover:shadow-darkbg/50" onclick={() => {
              openURL(relatedLink.href)
            }}>
              <div class="relative z-10 w-[68%] sm:w-[70%]">
                  <h2 class="text-2xl font-bold tracking-tight text-textcolor">{relatedLink.title}</h2>
                  <span class="mt-2 block text-base leading-relaxed text-textcolor2">
                    {relatedLink.description}
                  </span>
              </div>
              
              <div aria-hidden="true" class="pointer-events-none absolute -right-12 top-1/2 -translate-y-1/2 text-textcolor">
                  {#if relatedLink.logoIcon === "globe"}
                    <GlobeIcon class={relatedLinkIconClass} strokeWidth={1} />
                  {:else if relatedLink.logoIcon === "mail"}
                    <MailIcon class={relatedLinkIconClass} strokeWidth={1} />
                  {:else if relatedLink.logoIcon === "paper-airplane"}
                    <Send class={relatedLinkIconClass} strokeWidth={1} />
                  {:else if relatedLink.logoIcon === "source"}
                    <FolderCodeIcon class={relatedLinkIconClass} strokeWidth={1} />
                  {/if}
              </div>
            </button>
          {/each}
      </div>

  </div>
</div>

<style>
  .main-menu-shell {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--risu-theme-focus) 5%, transparent) 1px, transparent 1px),
      linear-gradient(color-mix(in srgb, var(--risu-theme-focus) 5%, transparent) 1px, transparent 1px),
      radial-gradient(circle at 82% 7%, color-mix(in srgb, var(--risu-theme-action-primary) 17%, transparent), transparent 34%),
      var(--risu-theme-canvas);
    background-size: 40px 40px, 40px 40px, auto, auto;
  }

  .main-menu-hero {
    background: linear-gradient(115deg, color-mix(in srgb, var(--risu-theme-darkbg) 92%, var(--risu-theme-action-primary)), var(--risu-theme-darkbg));
    border: 1px solid var(--risu-theme-darkborderc);
    border-left: 4px solid var(--risu-theme-focus);
    box-shadow: 0 20px 50px rgb(0 0 0 / 0.16), 0 0 35px color-mix(in srgb, var(--risu-theme-focus) 9%, transparent);
    margin: 2rem 1rem 0;
    min-height: 19rem;
    overflow: hidden;
    padding: 1.75rem 2rem 2.25rem;
    position: relative;
    width: min(100% - 2rem, 56rem);
  }

  .main-menu-hero-top {
    align-items: start;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
    justify-content: space-between;
    position: relative;
    z-index: 1;
  }

  .main-menu-brand {
    color: var(--risu-theme-textcolor);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.07em;
  }

  .main-menu-brand span { color: var(--risu-theme-focus); }

  .main-menu-version {
    color: var(--risu-theme-textcolor2);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    padding-top: 0.7rem;
  }

  .main-menu-hero-copy {
    max-width: 32rem;
    padding-top: 3.2rem;
    position: relative;
    z-index: 1;
  }

  .main-menu-hero-copy h1 {
    color: var(--risu-theme-textcolor);
    font-size: clamp(2rem, 4vw, 3.1rem);
    font-weight: 700;
    letter-spacing: -0.055em;
    line-height: 1.08;
  }

  .main-menu-hero-copy p {
    color: var(--risu-theme-textcolor2);
    font-size: 1rem;
    line-height: 1.5;
    margin-top: 1rem;
  }

  .main-menu-orbit {
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--risu-theme-focus) 55%, transparent);
    border-radius: 50%;
    box-shadow: 0 0 0 2.7rem color-mix(in srgb, var(--risu-theme-focus) 5%, transparent), 0 0 0 5.4rem color-mix(in srgb, var(--risu-theme-action-primary) 5%, transparent);
    color: var(--risu-theme-focus);
    display: flex;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 5rem;
    font-weight: 700;
    height: 12rem;
    justify-content: center;
    opacity: 0.58;
    position: absolute;
    right: -1.5rem;
    top: 5.5rem;
    transform: rotate(-18deg);
    width: 12rem;
  }

  .main-menu-track {
    background: color-mix(in srgb, var(--risu-theme-focus) 25%, transparent);
    bottom: 0;
    height: 2px;
    left: 0;
    position: absolute;
    right: 0;
  }

  .main-menu-track span {
    background: var(--risu-theme-focus);
    box-shadow: 0 0 14px var(--risu-theme-focus);
    display: block;
    height: 2px;
    width: 26%;
  }

  @media (max-width: 640px) {
    .main-menu-hero {
      margin-top: 1rem;
      min-height: 18rem;
      padding: 1.25rem 1.25rem 2rem;
    }

    .main-menu-hero-copy { padding-top: 2.5rem; }
    .main-menu-orbit { opacity: 0.2; right: -5rem; }
  }
</style>
