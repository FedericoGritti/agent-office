# Come entrare nell'Agent Office (macchina `z13`)

Ciao! Questo è il modo per entrare nel mio Agent Office, una "office" 3D in cui si lavora
con agenti di coding. L'accesso passa da **Tailscale** (una VPN privata): non serve aprire
porte né fare tunnel SSH, ma **devi avere Tailscale installato e connesso**.

Data: 2026-10-08.

---

## Cosa ti serve

1. Un account **Tailscale** tuo (gratuito) — registrazione su <https://tailscale.com>.
2. L'app **Tailscale** installata su questo computer (o telefono): <https://tailscale.com/download>.
3. Un browser.
4. *(Per accettare la condivisione)* devi essere **Owner o Admin della tua tailnet**.
   Se non lo sei, fai creare/accedere con un account che lo sia.

Non serve nient'altro: niente SSH, niente VPN manuali, niente porte.

---

## Passi

### 1. Installa e accedi a Tailscale
Installa l'app e fai login con il **tuo** account. Verifica che sia connesso
(l'icona in alto non deve dire "disconnesso").

```bash
tailscale status          # deve elencare, tra gli altri, il nodo "z13"
```

### 2. Accetta la condivisione
Ti ho mandato un invito (**email** o **link**) per la macchina `z13`.
Aprilo e **accetta** (nella Admin console → *Machines* → *Shared with me*, o direttamente dal link).

- Così vedi **solo** la macchina `z13`, e nient'altro della mia rete.
- Il link d'invito scade dopo 30 giorni: se è scaduto, te ne mando un altro.

### 3. Apri l'office
Nel browser, **con Tailscale connesso**:

```
https://z13.wildebeest-mine.ts.net
```

### 4. Accedi all'office
Ti mando anche un link del tipo:

```
https://z13.wildebeest-mine.ts.net/join#<token>
```

Aprilo: scegli **nome** e **password** (i tuoi) e sei dentro. Il link è monouso e vale 7 giorni;
se scade, te ne genero un altro.

Se non hai ancora l'account, per il primo accesso posso darti la password condivisa dell'office,
ma poi passiamo al tuo account personale (così i tuoi worker usano il **tuo** Claude/GitHub).

---

## Cosa puoi fare

- Camminare nell'ufficio 3D (WASD, mouse) e vedere gli altri in tempo reale.
- **Chat**: `T`.
- **Lavagna condivisa**: `📝` nel menu o `E` alla lavagna — si disegna insieme, live.
- **Terminali dei worker**: `E` su una scrivania occupata; si può scrivere in più persone.
- **Voce**: `V` per entrare; poi **tieni premuto `V`** per parlare. `M` muta/riattiva.
- **Condivisione schermo**: dal menu — e il tuo schermo finisce sulla TV del lounge.

Voce e condivisione schermo funzionano perché l'accesso è in **HTTPS**.

---

## Cosa NON è raggiungibile

- **SSH** e gli altri servizi di `z13`.
- I **dev server dei worker** (le anteprime tipo `http://localhost:5173`), a meno che io non
  apra quella porta apposta per te. Se ti serve, dimmelo.

---

## Se non si connette

1. Sei **connesso a Tailscale**? (`tailscale status` deve mostrare `z13`.)
2. La **condivisione è ancora attiva**? Se l'ho revocata, perdi l'accesso (posso rimandarla).
3. Prova `tailscale ping z13`: se risponde, il nodo è raggiungibile.
4. **MagicDNS**: il nome `z13.wildebeest-mine.ts.net` deve risolvere — di norma è attivo di default.
5. Aggiorna Tailscale se è molto vecchio.

---

## Note

- L'office gira su una macchina **mia** (`z13`): tutto quello che fai lì (chat, terminali,
  lavagna) è visibile a chi è nell'office.
- Posso **toglierti l'accesso in qualsiasi momento** (revoca della condivisione e/o revoca
  dell'account): a quel punto la URL smette di rispondere e/o non puoi più accedere.
- Da telefono funziona: app Tailscale + browser; c'è anche una vista 2D leggera su `/lite`.
