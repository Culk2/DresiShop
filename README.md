# Dresi Shop

React/Vite projekt za prodajo dresov z administracijskim delom, prilagojen kot osnova za solsko nalogo.

## Vkljucene funkcionalnosti

- CRUD za izdelke v admin panelu
- Clerk avtentikacija za prijavo, registracijo in zasciten admin del
- pregled statistike, filtriranje in sortiranje
- vizualizacija prodaje po klubih
- uvoz izdelkov iz `.csv` ali `.xlsx`
- simulacija nakupa z avtomatskim email dogodkom
- rocno posiljanje obvestil strankam iz admin panela
- izvoz narocil v `.pdf`
- uporaba zunanjega API-ja za podatke o klubih
- lokalno shranjevanje podatkov preko `localStorage`

## Zagon

```bash
npm install
npm run dev
```

## Clerk nastavitev

1. V Clerk Dashboard ustvari aplikacijo.
2. Kopiraj `Publishable key`.
3. Ustvari `.env` datoteko iz `.env.example`.
4. Nastavi `VITE_CLERK_PUBLISHABLE_KEY=...`.
5. Ponovno zazeni razvojni streznik z `npm run dev`.
