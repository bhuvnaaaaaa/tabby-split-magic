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
- Keep Tabby's simulated expense parsing and receipt preview client-side; no OCR, real payment links, or persistent data are implied by the demo.
- Define the visual system and responsive layouts in src/styles.css and use shared Button variants for interactive controls to keep themes consistent.
