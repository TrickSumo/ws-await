# Local Development Guide

How to test `@tricksumo/ws-await` locally in a React app without publishing to npm.

## Why yalc instead of npm link

`npm link` symlinks your entire library folder including its `node_modules/`. This causes two copies of React in memory, which breaks hooks with the error:

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
```

`yalc` copies only your built `dist/` — exactly like a real `npm install` would. No symlink, no duplicate React, no config changes needed in the consuming app.

## One-time setup

Install yalc globally:

```bash
npm install -g yalc
```

## First-time linking

**Step 1 — Build the library and publish to the local yalc store:**

```bash
# in ws-await/
npm run build
yalc publish
```

**Step 2 — Add it to your React app:**

```bash
# in your React app/
yalc add @tricksumo/ws-await
npm install
```

Your app's `package.json` will now have:

```json
"@tricksumo/ws-await": "file:.yalc/@tricksumo/ws-await"
```

## After every change to the library

```bash
# in ws-await/
npm run build && yalc push
```

`yalc push` updates all apps that have linked the library. Vite hot-reloads automatically after that.

## Fully automatic watch mode (optional)

Add this script to `package.json` in the library:

```json
"dev:linked": "tsup --watch --onSuccess \"yalc push\""
```

Then run:

```bash
npm run dev:linked
```

Every time you save a source file, tsup rebuilds and pushes to yalc. Vite picks it up instantly.

## Removing the yalc link

```bash
# in your React app/
yalc remove @tricksumo/ws-await
npm install
```
