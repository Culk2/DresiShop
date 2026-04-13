# Dresi Shop

React + Vite shop povezan s Clerk prijavo in Sanity bazo.

## Kaj zdaj dela

- izdelki se berejo in shranjujejo v Sanity
- ob prvi prijavi se za Clerk uporabnika ustvari `userProfile` z vlogo `user`
- admin lahko uporabnikom spremeni vlogo na `admin`
- uporabnik lahko doda izdelke v kosarico in odda narocilo
- oddano narocilo se shrani v Sanity, zaloga izdelkov pa se zmanjsa
- admin panel prikaze vse uporabnike, narocila in katalog izdelkov
- admin lahko izvozi narocila v PDF

## Zagon

```bash
npm install
npm run dev
```

## `.env`

Projekt potrebuje:

```env
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_SANITY_PROJECT_ID=...
VITE_SANITY_DATASET=production
VITE_SANITY_API_TOKEN=...
```

## Sanity sheme

Primer shem je v `sanity/schemaTypes/dresiShopSchema.js`.

Ce imas Sanity Studio, dodaj:

```js
import { schemaTypes } from "./schemaTypes/dresiShopSchema";

export default createSchema({
  name: "default",
  types: schemaTypes,
});
```

## Opomba

Ta verzija uporablja Sanity token v Vite frontendu, da lahko projekt deluje brez backend API-ja. To je primerno za demo ali solo projekt, ni pa varno za produkcijo. Za produkcijo prestavi vse write operacije na backend in zamenjaj token.
