# Tabby Split Magic

Build a responsive web app called Tabby with a warm, editorial aesthetic that evokes trust, curiosity, and warmth.

1. Human-Centered Typography & Palette:

Import fonts: Fraunces (soft serif display for titles) and Plus Jakarta Sans (for clean, legible UI text).

Canvas: Warm milk-lavender cream background (#faf8fc), floating card surfaces in pure milk-white (#ffffff) with ultra-fine lilac borders (#ede8f5) and soft ambient shadows (shadow-sm to shadow-md).

Text: Deep espresso-plum (#241a2f) for primary copy, muted mauve (#6e627c) for subtitles, and a rich, grounded violet-indigo (#6342db) for primary buttons and interactive accents.

Avoid all AI-style robotic gradients and rocket/sparkle emojis. Use clean, minimalist SVG line icons (receipt, check, message-circle, arrow-right).

2. Header & Clean Hero:

Header: Logo Tabby in Fraunces bold with a tiny terracotta receipt dot, a currency toggle (₹ INR, $ USD, € EUR), and a minimal theme toggle.

Hero Text:

Main Heading (Fraunces serif): 'Good times with friends, settled without the awkward math.'

Subtitle: 'Paste your dinner notes, trip recap, or upload a bill. We’ll untangle who paid, split shared taxes equally, and give you clean 1-tap links.'

3. Input Card & Loading States:

A clean, spacious white card with a subtle border.

Textarea with friendly placeholder: 'e.g., 4 of us grabbed pizza and cabs. Maya paid 1800 for food, Rohan paid 600 for cab. Tax was 120. Split equally.'

Below textarea, place 3 clean text pill buttons: [Road trip cabin], [Weekend dinner & cabs], [Monthly flat utilities].

Two action buttons: Primary violet button 'Untangle Tab' and an outlined camera button 'Upload Receipt'.

4. SWE Architecture & Skeleton State:

Build a toggleable loading skeleton state: When parsing is simulated, render 3 pulsing, rounded card frames shaped like the final transaction cards (animate-pulse with soft lavender fills) so the UI transitions smoothly without layout shift.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tabby-split-magic.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/faf4698e-b141-42df-b08a-6dd96cc748d3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
