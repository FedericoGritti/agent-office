# Esporti l'office di z13 a un amico (Tailscale, solo nodo `z13`, solo porta 443)

Doc per me. Macchina: **z13**. Data: 2026-10-08.

Obiettivo: far entrare un amico nell'Agent Office che gira su z13, **temporaneamente**,
**senza aprire porte su Internet** e **senza dargli accesso al resto della rete**:
solo il nodo `z13` e solo la porta 443 (l'office). Tutto revocabile in una riga.

---

## 0. Stato di partenza (già verificato il 2026-10-08)

| Cosa | Valore |
|---|---|
| Host | `z13` (Linux) |
| Nodo Tailscale | `z13` — `100.113.25.108` |
| Tailnet | `wildebeest-mine.ts.net` (owner `federico.alej.gritti@gmail.com`) |
| Tailscale | `1.102.3` (`/usr/bin/tailscale`) |
| Office | da `~/raspnas/system/personalization/llms/agents/tool_homes/agent_office`, comando `office` |
| Comando office | `/home/fjg/.local/bin/office` → `node bin/agent-office.js --home /home/fjg/agent-office --agent omp` |
| Processo attuale | `node <repo>/bin/agent-office.js --home /home/fjg/agent-office --agent omp --host 127.0.0.1 --port 4600 --trust-proxy --no-open` |
| Ascolto | `127.0.0.1:4600` (loopback) |
| Serve già attivo | `https://z13.wildebeest-mine.ts.net` → `127.0.0.1:4600` (l'office) **e** `http://z13:8384` → `127.0.0.1:8384` (**altro servizio, da NON condividere**) |
| Account office | nessuno; **password condivisa attiva** |

La password condivisa sta in chiaro in `/home/fjg/agent-office/.agent-office/config.json`
(leggibile solo dal tuo utente). Non incollarla in chat: agli ospiti si dà un account.

Verifica rapida:

```bash
tailscale status
tailscale serve status
node /home/fjg/raspnas/system/personalization/llms/agents/tool_homes/agent_office/bin/agent-office.js \
  accounts -d /home/fjg/agent-office
```

Devi vedere `https://z13.wildebeest-mine.ts.net (tailnet only) |-- / proxy http://127.0.0.1:4600`.

---

## 1. Pubblicare l'office sulla tailnet (Serve) — già fatto

L'ufficio è già pubblicato via **Tailscale Serve** su HTTPS/443:

```bash
tailscale serve status
# https://z13.wildebeest-mine.ts.net (tailnet only)
# |-- / proxy http://127.0.0.1:4600
```

Se un giorno manca l'endpoint (o dopo un `reset`), ricrealo:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:4600
```

Prerequisiti (già ok su questo tailnet):

- **MagicDNS** e **HTTPS Certificates** attivi: admin console → *DNS*.
- L'office deve girare su `127.0.0.1` **con `--trust-proxy`** (perché Serve dice a ogni
  richiesta che è arrivata in HTTPS, così i cookie sono `Secure` e i limiti di login
  contano ogni persona). Il processo attuale ce l'ha. Se lo riavvii, usa esattamente:

```bash
office --host 127.0.0.1 --port 4600 --trust-proxy --no-open
```

Perché Serve: la URL è HTTPS → è un **secure origin**, quindi **voce (V) e condivisione
schermo funzionano**; e non c'è nessuna porta aperta su Internet (Tailscale è solo traffico in uscita).

---

## 2. Restringere l'accesso a una sola porta (ACL)

La condivisione del nodo dà all'ospite *quel nodo*; la policy decide *quali porte*.
Admin console → **Access controls** → metti (o aggiungi) qualcosa come:

```hujson
{
  "grants": [
    // I membri della tua tailnet: come prima, accesso pieno.
    { "src": ["autogroup:member"], "dst": ["*"], "ip": ["*"] },

    // Gli ospiti esterni (chi accetta la condivisione): SOLO la 443 di z13 = l'office.
    { "src": ["autogroup:shared"], "dst": ["z13"], "ip": ["tcp:443"] }
  ]
}
```

⚠️ Due trappole:

1. Se hai la regola di default `"src": ["*"]` (accept-all), questa **copre anche gli
   invitati**: l'amico vedrebbe pure `:8384` e ogni altra porta di z13. Va tolta o
   ristretta (per questo sopra uso `autogroup:member` per i tuoi e `autogroup:shared` per gli ospiti).
2. Le `grants` sono deny-by-default: se aggiungi solo la regola dell'ospite, i tuoi utenti
   perdono l'accesso. Tieni entrambe le regole.

Vuoi mandarlo a una persona sola invece che a tutti gli invitati? Sostituisci
`autogroup:shared` con la sua email:

```hujson
{ "src": ["amico@example.com"], "dst": ["z13"], "ip": ["tcp:443"] }
```

---

## 3. Condividere il nodo `z13` con l'amico

Admin console → **Machines** → `z13` → menu **…** → **Share**:

- **Share by email**: email dell'amico (gli arriva un link d'invito); oppure
- **Copy invite link**: link monouso (o riutilizzabile) da mandargli — **scade dopo 30 giorni**.

Note utili:

- Per **accettare**, l'amico deve essere **Owner/Admin della propria tailnet** e avere
  Tailscale installato e loggato col **suo** account (mai il tuo).
- Il nodo condiviso è **in quarantena** di default: riceve connessioni, non ne inizia. Sicuro by default.
- Vede **solo** `z13`, nient'altro della tua rete.
- **Revoca**: Machines → `z13` → Share → ⋮ → *Revoke invite* (immediato).

---

## 4. Creare l'account office dell'amico

Dagli un account suo (non la password condivisa): il suo nome comparirà su personaggio,
chat e terminali, e userà il **suo** Claude/GitHub.

Definisci una volta il comando (vale per la sessione della shell):

```bash
AO="node /home/fjg/raspnas/system/personalization/llms/agents/tool_homes/agent_office/bin/agent-office.js accounts -d /home/fjg/agent-office"
```

```bash
$AO invite <nome>            # stampa https://z13.wildebeest-mine.ts.net/join#<token>
```

Stampa un link `/join#<token>` **monouso, valido 7 giorni**. Mandagli l'indirizzo completo:

```
https://z13.wildebeest-mine.ts.net/join#<token>
```

- Primo account? Fallo admin: `$AO invite <nome> --admin` (serve ad almeno un admin).
- Ruolo: `$AO role <nome> admin|member`.
- Revoca: `$AO revoke <nome>` (lo butta fuori in pochi secondi).
- Elenco: `$AO` (o `$AO list`).
- Quando **tutti** hanno un account, togli la password condivisa:
  `$AO password off` (rifiuta se non esiste ancora un admin).
- Il wrapper `office accounts …` **non** funziona (inietta `--agent omp` prima del
  sottocomando, che va invece per primo): usa il comando `$AO` qui sopra.

---

## 5. Verifica end-to-end

```bash
tailscale serve status                      # 443 -> 127.0.0.1:4600
$AO                                         # l'invito appare tra "Open invites"
```

- Apri tu per primo `https://z13.wildebeest-mine.ts.net` dal browser di z13: deve caricare l'office.
- Poi fallo dall'amico (dopo che ha accettato la condivisione): stessa URL.
- Se l'office chiede il login, il link `/join#…` gli fa scegliere nome e password.

---

## 6. Chiudere tutto quando basta (temporaneo)

```bash
tailscale serve --https=443 off      # toglie SOLO l'office; il :8384 resta
```

Attenzione: `tailscale serve reset` toglie **tutto** il serve (anche `:8384`). Per ripristinare
l'office dopo un reset: `tailscale serve --bg --https=443 http://127.0.0.1:4600`.

Poi, per chiudere del tutto:

1. Admin console → Machines → `z13` → Share → **Revoke invite** (l'URL smette di rispondere).
2. `$AO revoke <nome>` (perde l'accesso all'office).
3. (Opzionale) `$AO password on` per riattivare la password condivisa.

---

## 7. Se qualcosa non va

| Sintomo | Causa probabile | Rimedio |
|---|---|---|
| L'amico: "site can't be reached" | Non è connesso a Tailscale, o non ha accettato la share | `tailscale status`, accetta la condivisione |
| Raggiunge z13 ma non l'office | Manca la grant `tcp:443` per `autogroup:shared`, o `dst` non è `z13` | Correggi la policy (vedi §2) |
| Vede anche `:8384` o altre porte | C'è una regola `src:["*"]` che copre gli invitati | Restringi come in §2 |
| Il nome non risolve | MagicDNS off da un lato | Accendilo (admin console → DNS) |
| Login "Wrong password" | Ha usato l'account sbagliato o nessun link `/join` | Rigenera un invito (§4) |
| Dopo `serve reset` l'office è sparito | Reset ha tolto tutti i serve | `tailscale serve --bg --https=443 http://127.0.0.1:4600` |

Riferimenti: [Tailscale Sharing](https://tailscale.com/docs/features/sharing) ·
[Grants](https://tailscale.com/docs/features/access-control/grants) ·
[tailscale serve](https://tailscale.com/docs/reference/tailscale-cli/serve) ·
`docs/aws.md` (§Tailscale) nel repo dell'office.
