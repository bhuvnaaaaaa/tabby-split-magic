<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application structure
- Parse expense notes through an AI-backed TanStack server function with a regex client fallback; receipt images remain previews, without OCR or real payment links.
- Use integer minor units for all liabilities and transfers; group overhead is allocated once and decimal numbers are only DTO/display values, preventing floating-point leakage.
- Validate strict extraction schemas and cross-references before computing balances; local fallback rejects unsupported notes instead of guessing financial obligations.
- Keep AI helpers server-only and persist terminal access/credit pauses in a service-only circuit table; owner-confirmed recovery must clear the pause before fresh online requests.
- Define the visual system and responsive layouts in src/styles.css and use shared Button variants for interactive controls to keep themes consistent.
