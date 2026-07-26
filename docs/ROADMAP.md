# Roadmap

What's next for this project, and the series it belongs to.

The constraint is the same throughout: **take an architecture that normally
assumes a GPU cluster and a corporate cloud bill, and rebuild it so it runs on a
laptop for nothing.** Each one ships as a repo you can clone and run.

---

## Next in this repo

Ordered by how much each would change what the demo can honestly claim.

### 1. Vision on the warehouse floor
The biggest gap in this system is that it can only read structured data and
text. Real warehouse operations are visual: dock congestion, blocked fire exits,
pallets stacked wrong, damage on receipt. A vision model over camera stills —
or short clips — turns "what does the database say" into "what is actually
happening", and feeds detections straight into the existing safety-incident
table. Free vision APIs make this possible without a GPU.

### 2. Voice for hands-free operation
Someone on a forklift cannot type. Speech in, speech out — local Whisper for
transcription, a free TTS voice for the reply — makes the assistant usable by
the people who actually work the floor rather than the manager reading a
dashboard. This is the single change that would move it from demo to tool.

### 3. OCR for scanned documents
`pdfplumber` reads embedded text only, so an image-only PDF extracts nothing.
The app is honest about it — it flags the document and explains why — but the
real fix is a Tesseract fallback when extraction comes back empty. Free, local,
no API.

### 4. A model registry that means something
Trained models are rows in `model_training_history` with no notion of an
*active* version, promotion or rollback. "Which model is serving?" currently has
no answer. Adding `is_active` and versioning turns the forecasting page from a
training toy into a credible MLOps surface.

### 5. Honest evaluation baselines
MAPE is reported without a naive baseline, so the numbers float free. Every
model should be scored against "predict yesterday's value", and anything that
can't beat it should be flagged. This makes the forecasting story *more*
believable, not less.

---

## The series

Same constraint, applied across the modalities that real operations actually
involve — text, documents, images, video, audio — and the agent and decision
layers that sit on top.

| # | Project | Modality | The question it answers |
|---|---|---|---|
| **1** | **WarehouseOps AI** *(this repo)* | Text · structured data | Can a multi-agent operations assistant with tool routing and guardrails run on free infrastructure? |
| **2** | **Video incident intelligence** | **Video · vision** | Hours of camera footage, searchable in plain language. "Show me every time the loading bay was blocked last week." Summarize a shift into the five moments that mattered, and open a safety incident automatically. This is the one operations teams ask for first. |
| **3** | **Voice operations agent** | **Audio · speech** | A hands-free assistant for people wearing gloves. Local speech-to-text, a free voice for the reply, and the same agent layer underneath — including Hinglish, because that's what warehouse floors in India actually speak. |
| **4** | **Catalogue enrichment from a photo** | **Image · text** | Point a camera at a product, get a listing: title, description, attributes, category, in English and Hindi. The clearest money story in the set — it's a job small sellers currently do by hand. |
| **5** | **Document intelligence with a review loop** | **Documents · text** | Extract → validate → route → human review. Invoices and contracts in, structured records out, with anything low-confidence queued for a person instead of silently guessed. The half of document AI that demos always skip. |
| **6** | **Decision agent under constraints** | **Optimisation · reasoning** | Slotting, replenishment and labour allocation as a constrained decision problem, with the agent explaining the trade-off it made. Moves the series from *answering questions* to *making calls* — and being accountable for them. |

Two threads run through all six: **agent frameworks** (planning, tool routing,
memory, guardrails) and **decision-making you can audit**. The modality changes;
the discipline doesn't.

If one of these is more useful to you than the others, say so in an issue — the
order isn't fixed.

---

## Contributing

Bug reports from people who ran this against **real warehouse data** are the
most valuable thing I can get. The sample dataset is synthetic and well-behaved;
yours won't be. See [CONTRIBUTING.md](../CONTRIBUTING.md).
