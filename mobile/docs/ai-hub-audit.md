# AI Hub on Android — capability audit

Scope: every AI Hub feature in `mobile/`, checked against what the **server
actually does** (`app/api/ai-hub/*`, `lib/aiHub.ts`) and what the **web client
renders** (`components/markdown/`, `components/ai-hub/`).

Method: static analysis of both clients plus the server contract. The mobile app
does not currently compile (`src/api/study.ts` is mid-recovery — see
`RECOVERY-NEEDED.md`), so nothing here was confirmed on a device. Each row says
what the evidence is.

---

## 1. The thing that matters most

`lib/aiHub.ts` — the system prompt — **instructs the model to emit four
structures that mobile cannot render**:

| Prompt instruction (`lib/aiHub.ts`) | Web renders it | Mobile renders it |
| --- | --- | --- |
| "Emit it as a fenced ` ```mermaid ` block" (:39) | `MermaidDiagram` | raw Mermaid source in a code block |
| "Emit it as a fenced ` ```chart ` block containing JSON" (:46-48) | `ChartBlock` → Recharts | raw JSON in a code block |
| "Emit it as `~~~file` … JSON … `format` is `pdf` or `docx`" (:52-58) | `GeneratedFileCard` | raw JSON **as a paragraph** |
| "tables … in Markdown" (:57) | GFM table renderer | flat pipe-delimited text |

So the failure is not a rendering nicety. When a student asks for a diagram, a
comparison, or a document, the server produces the right thing and the app shows
them JSON.

**`~~~file` is the worst of the four.** It is not a fence mobile even
recognises: `parseReplyBlocks` matches triple *backticks* only, so the tilde
block is treated as ordinary prose and the literal
`{"filename":…,"markdown":"…"}` is printed into the chat bubble. A generated
document looks like a crash.

---

## 2. Feature matrix

Legend: **Yes** works · **Partial** works with a caveat · **No** absent ·
**n/a** not a mobile surface

### Chat

| Feature | Mobile | Evidence |
| --- | --- | --- |
| SSE token streaming | Yes *(pre-existing, mid-recovery)* | APK bundle contains `onToken`, `onReasoning`, and the string `"The AI response ended unexpectedly before it was complete."` |
| Reasoning-channel split | Yes *(pre-existing, mid-recovery)* | `hub.tsx` renders `msg.reasoning` as a collapsible trace; APK contains `reasoningLabel`, `"Toggle the AI thinking trace"` |
| Thinking / streaming state | Yes | `ThinkingIndicator` in `hub.tsx` — three muted dots + mono label |
| Thread CRUD | Partial | `hub.tsx` (create/list/load), `ThreadsDrawer` (list), `conversations.tsx` (rename/delete). Threads work. |
| Thread search | Yes | `ThreadsDrawer` filters locally by title |
| Model picker | **No** | `/api/ai-hub/models` exists and the route accepts `modelSelection`, but mobile has no models client and no picker. The Hub's pill is hardcoded `"Ready"`. |
| Grounding citations | Partial | Server sends `documentsUsed: [{id, filename}]` — **no page number and no chunk count**, so the mockup's "page 14 · grounded on 3 chunks" is not reconstructable. Mobile renders `"grounded on N chunks"` from `documentIds.length`, which is the requested-doc count, not retrieved chunks. |
| Attachments (image/file on a message) | No | `ThreadAttachment` type exists; no picker or renderer |

### Documents

| Feature | Mobile | Evidence |
| --- | --- | --- |
| PDF upload | Yes | `app/upload.tsx` → `uploadStudyDocument` → `/api/ai-hub/upload` |
| **DOCX upload** | **No — impossible** | Server `sniffFileType` (`lib/security.ts:119-137`) accepts **pdf, png, jpeg, gif, webp only**; anything else is `415`. The mobile picker also hard-filters `type: ['application/pdf']` and rejects non-`.pdf` by name. |
| Image upload | **No** | Server accepts images, mobile picker excludes them |
| In-app PDF viewing | **No** | `app/document.tsx` shows an AI *summary* split into sections plus concept tags. The original PDF is never rendered. |
| Offline document save | Partial | `fetchDocumentSummary` caches the summary text; the file itself is not stored |
| Document summary | Yes | `app/document.tsx` |
| Practice questions from a doc | Yes | `app/quiz.tsx`, `app/flashcards.tsx` |

### Generated files (the `~~~file` feature)

| Feature | Mobile | Evidence |
| --- | --- | --- |
| Detect a `~~~file` block | **No** | `parseReplyBlocks` has no tilde handling |
| Render a file card | **No** | No equivalent of `GeneratedFileCard` |
| Build a PDF | **No** | Web uses `buildPdfBlob` from rendered blocks. Mobile *has* `expo-print` + `expo-sharing` installed but nothing calls them for documents. |
| Build a DOCX | **No** | Web uses `buildDocxBlob`; mobile has no equivalent |
| Build Markdown | **No** | trivial, absent |

### Voice

| Feature | Mobile | Evidence |
| --- | --- | --- |
| Speech-to-text (Sarvam) | **No** | No client for `/api/voice/transcribe`; no recording dependency (`expo-av`/`expo-audio` not installed) |
| Text-to-speech replies | **No** | No client for `/api/voice/speak`. The Me screen's "Voice replies" row writes a preference that nothing reads. |
| Mic affordance | Cosmetic | Career's mic button (`AppHeader trailing`) navigates to the Hub; it does not record |

`src/services/audioService.ts` is a **focus-mode music player** (SoundHelix
tracks) — not voice. Worth knowing before reading it as evidence of TTS.

### Rich content — detail

| Content | Mobile |
| --- | --- |
| Paragraphs | Yes |
| Headings (`#`–`######`) | Yes |
| Bullet + numbered lists | Yes |
| Inline `**bold**`, `*italic*`, `` `code` `` | Yes (`parseInline`) |
| Fenced code | Yes — dark panel, mono |
| Syntax highlighting | No — plain mono. Web has `highlight.js`. |
| **GFM tables** | **No** |
| **LaTeX / KaTeX (`$…$`, `$$…$$`)** | **No** — raw TeX |
| **Mermaid** | **No** — raw source |
| **Charts (` ```chart `)** | **No** — raw JSON |
| **Generated file blocks (`~~~file`)** | **No** — raw JSON as prose |
| Images in a reply | No |
| Links | No — rendered as literal text, not tappable |
| Blockquotes | No — the `>` is printed |
| Horizontal rules | No |
| Strikethrough | No |
| Task lists | No |

For contrast, the web `MarkdownContent` wires `remark-gfm`, `remark-math`,
`rehype-katex`, `MermaidDiagram`, `ChartBlock` and `GeneratedFileCard`, with
custom renderers for `table`/`thead`/`tbody`.

---

## 3. Prioritised fix list

Ordered by impact on a student actually using the Hub.

### P0 — the app shows JSON instead of the answer

1. **Parse `~~~file` blocks.** Extend `replyParsers.ts` to recognise a `~~~file`
   fence and return `{ filename, format, title, markdown }`. Without this, every
   document request prints raw JSON.
2. **Render a generated-file card.** Filename, size, primary download, plus the
   other formats one tap away (`GeneratedFileCard` is the reference).
3. **Produce the file on device.** `expo-print` (`printToFileAsync`) for PDF and
   `expo-sharing` to hand it off — **both already installed**, so this is
   wiring, not new dependencies. DOCX has no RN equivalent; ship Markdown + PDF
   first and offer "copy text" for Word, or build the `.docx` OOXML zip by hand
   later.

   Already available and relevant: `expo-print`, `expo-sharing`, `expo-linking`,
   `expo-document-picker`, `react-native-svg`. **Not** present:
   `react-native-webview`, any audio/recording module, any DOCX library.

### P1 — diagrams and data

4. **Render markdown tables.** A GFM table is the single most likely output of
   "compare X and Y"; it currently collapses into pipes.
5. **Handle ` ```mermaid `.** Needs a renderer, and there is no shortcut: Mermaid
   is rendered **client-side everywhere today** (`MarkdownContent` lazily
   imports it; `GeneratedFileCard` polls the DOM for the finished `<svg>` before
   exporting, with a 4s give-up). No server route emits diagram SVG, so the
   options are all new work:
   (a) **add a server route** that turns a Mermaid definition into SVG and
   return it to the app to display with `react-native-svg` — reuses the exact
   Mermaid version the web already pins, keeps the client thin, caches well, and
   is the only option that also works for the PDF export path;
   (b) `react-native-webview` with bundled Mermaid — ~2.5 MB, a native rebuild,
   and a second rendering parity surface to maintain;
   (c) a **degraded card**: show the diagram source in a collapsible block with
   "This diagram is best viewed on the web." Cheap, honest, ships today.
   (c) is the right v1; (a) is the right v2. Do not attempt (b) first.
6. **Handle ` ```chart `.** Much cheaper than Mermaid, because the payload is
   already flat JSON — `{"type":"bar|line|area|pie","title":…,"data":[{"label",
   "value"}]}` — and `react-native-svg` is already a dependency. A native
   renderer for four chart types is a small, self-contained piece of work with
   no WebView and no new native module. This should be done before Mermaid.

### P2 — fidelity and reach

7. **KaTeX.** `$…$` currently shows raw TeX. A WebView with bundled KaTeX is the
   usual answer; alternatively strip delimiters and show plain symbols.
8. **Links** — make them tappable via `expo-linking` (`Linking.openURL`), and
   confirm the server's link-safety check applies.
9. **Syntax highlighting** for fenced code.
10. **DOCX.** If students need Word output, the server must accept and parse
    `.docx` first (`sniffFileType` + `mammoth`/`unzip` text extraction). This is
    a server change, not a client one — worth deciding before building a picker
    that cannot upload.
11. **Voice.** Two separate jobs: STT (`/api/voice/transcribe`, needs a recorder
    dep + `RECORD_AUDIO` + a non-webm container) and TTS (`/api/voice/speak`
    returns base64 WAV that must be written to a file before playback). Until
    then the Me screen's "Voice replies" toggle should be removed or disabled —
    a switch that does nothing is worse than no switch.

### P3 — polish

12. Model picker (`/api/ai-hub/models`), replacing the hardcoded "Ready" pill.
13. Real page-level citations, which needs the **server** to return page/chunk
    references in `documentsUsed`.
14. In-app PDF viewing.
15. Image upload (server already accepts it).

---

## 4. Two things that are not mobile bugs

- **Citations.** `documentsUsed` carries only `{id, filename}`. The mockup's
  "page 14 · grounded on 3 chunks" cannot be built client-side. Fix server-side.
- **DOCX.** Unreachable end to end today, by design of `sniffFileType`.

## 5. Caveat on this audit

`mobile/src/api/study.ts` is currently at git HEAD, so the SSE streaming client
and the reasoning-split types are **absent from the tree** — they are the
uncommitted work described in `RECOVERY-NEEDED.md`, not a capability gap I
measured. I have marked those rows as "pre-existing, mid-recovery" from APK
evidence rather than claiming them as verified. Once the file is restored, rows
1–2 of the chat table should be re-confirmed on device.
