# Wallet Brick — Troubleshooting

## Button broken by custom CSS

**Symptom**: Button doesn't render, looks wrong, or behaves unexpectedly.

**Cause:** Custom CSS is overriding the MP-managed button. The Wallet Brick button appearance is controlled by MercadoPago — do not target it with CSS.

**Do NOT do any of these:**
```css
#walletBrick_container { display: none; }
#walletBrick_container button { visibility: hidden; }
#walletBrick_container button { background-color: red !important; }
.my-overlay { position: absolute; z-index: 9999; top: 0; left: 0; width: 100%; height: 100%; }
```

```html
<!-- WRONG — injecting content into the container the Brick manages -->
<div id="walletBrick_container">
  <span>My custom text</span>
</div>
```

**Fix:** Remove any CSS or HTML that targets the Brick's internal elements. Use `customStyle` properties instead — see `./customization.md`.

---

## Button not rendering

**Symptom**: Container div is empty, no button appears.

**Checklist:**
1. Is the container div present in the DOM before `bricksBuilder.create()` runs?
2. Is the `preferenceId` a valid, non-expired string?
   - Check: `preference_id` should look like `123456789-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` // see '../../references/rules-preference.md'
3. Is the `PUBLIC_KEY` correct and from the right environment?
   - Sandbox: `TEST-...`
   - Production: `APP_USR-...`
4. Check browser console for errors
5. Verify MP SDK script is loaded before your JS

```js
// Debug: log the preference ID before creating brick
console.log("Preference ID:", PREFERENCE_ID);
// Should be a string, not null/undefined
```

---

## Redirect opens in wrong tab

**Symptom**: Expected redirect in same page but it opened in a new tab (or vice versa).

**Fix:** Check the `redirectMode` value in `initialization`:
- `"self"` — redirects in the same page (default)
- `"blank"` — opens in a new tab

```js
initialization: {
  preferenceId: PREFERENCE_ID,
  redirectMode: "self",  // same page (default)
  // redirectMode: "blank",  // new tab
}
```

---

## Preference expired error

**Symptom**: User clicks button and sees some similar error.

**Cause:** The preference could be expired. If `expires: true` and `expiration_date_to` was set, the preference is no longer valid.

**Fix:** Create a new preference for each checkout session — see `../../references/rules-preference.md`.

---

## back_url not receiving redirect

**Symptom**: Payment completes but browser doesn't redirect to success/failure pages.

**Causes:**
- `back_urls` not configured in the preference
- URLs have typos

**Fix:** Configure `back_urls` in the preference — see `../../references/rules-preference.md`.

**Fix:** Read the `status` query parameter on all back URL pages and display accordingly:


---

## Wrong MP account shown in checkout

**Symptom**: Checkout shows a different MP account or environment than expected.

**Cause:** Mixing production and sandbox credentials. // see ../../references/rules-bricks-setup.md

**Fix:** Ensure all credentials (PUBLIC_KEY, ACCESS_TOKEN) are from the same environment:
- Sandbox: `TEST-` prefixed keys
- Production: `APP_USR-` prefixed keys

---

## Preference items total doesn't match expected

**Symptom**: User sees a different amount in the MP checkout than on your site.

**Cause:** The total displayed in checkout is the sum of `items[].unit_price * quantity` across all items. MP does not automatically add taxes or shipping.

**Fix:** Include all costs in the preference. Two options:

1. Add shipping as an item:
```js
"items": [
  { "title": "Product", "quantity": 2, "unit_price": 50.00, "currency_id": "BRL" },
  { "title": "Shipping", "quantity": 1, "unit_price": 15.00, "currency_id": "BRL" }
]
// Total: (50 * 2) + (15 * 1) = 115.00
```

2. Use the `shipments` object to show shipping separately:
```js
"shipments": {
  "cost": 15.00,
  "mode": "not_specified"
}
```

See `../../references/rules-preference.md` for full preference configuration.

---

## Wallet button not working (preferenceId is a placeholder)

**Symptom**: The Wallet button renders but clicking it does nothing, or the Brick throws an error on render.

**Cause:** The `preferenceId` passed to `initialization` is a placeholder string copied from documentation instead of a real preference ID created via the API.

**Invalid preferenceId examples:**
- `<PREFERENCE_ID>` — template placeholder
- `preference_id` — variable name, not a value
- `YOUR_PREFERENCE_ID` — documentation placeholder
- `123456` — too short, wrong format
- Any hardcoded string that was never returned by `POST /checkout/preferences`

**Valid format:** `1234567890-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (string returned by the Preferences API)

**Fix:** Create a real preference via `POST https://api.mercadopago.com/checkout/preferences` with your ACCESS_TOKEN, then use the `id` from the response. See `../../references/rules-preference.md` for instructions.

---

## Button not loading — works sometimes, breaks other times

**Symptom**: The Wallet button sometimes renders correctly, but other times the container stays blank.

**Cause:** The code uses `setTimeout` to "wait" for the Brick to load. The problem is that `setTimeout` is a guess -- sometimes 2 seconds is enough, sometimes it's not. On slow connections or heavy pages, the Brick may still be loading when the timeout fires.

```js
// ❌ THE PROBLEM — guessing when the Brick is ready
await bricksBuilder.create("wallet", "walletBrick_container", settings);

setTimeout(() => {
  document.getElementById("loading").style.display = "none";
}, 2000); // 2 seconds is a guess — what if the Brick takes 3?
```

**Fix:** Replace `setTimeout` with the `onReady` callback. The Brick tells you exactly when it's ready -- no guessing.

```js
// ✅ THE FIX — let the Brick tell you when it's ready
const settings = {
  callbacks: {
    onReady: () => {
      // This fires ONLY when the Brick is 100% loaded and interactive
      document.getElementById("loading").style.display = "none";
    },
    onError: (error) => { console.error(error); },
  },
};
```

**Rule:** Never use `setTimeout` to wait for a Brick. Always use `onReady`.

---

## Error catalog and lifecycle

See `../../references/rules-errors.md` for the complete error catalog (initialization + communication errors) and lifecycle management rules.
