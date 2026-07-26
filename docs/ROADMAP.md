# Roadmap

What's next for this project, and the wider series it belongs to.

The theme is the same throughout: **take an architecture that normally assumes a
GPU cluster and a corporate cloud bill, and rebuild it so it runs on a laptop
for nothing.** Each one ships as a repo you can clone and run.

---

## Next in this repo

Ordered by how much they'd change what the demo can honestly claim.

### 1. OCR for scanned documents
Right now `pdfplumber` reads embedded text only, so an image-only PDF extracts
nothing. The app is honest about it — it flags the document for review and
explains why — but the real fix is a Tesseract fallback when the extracted text
comes back empty. Free, local, no API.

### 2. A model registry that means something
Trained models are rows in `model_training_history` with no notion of an
*active* version, promotion or rollback. "Which model is serving?" currently has
no answer. Adding `is_active` and versioning turns the forecasting page from a
training toy into a credible MLOps surface.

### 3. Honest evaluation baselines
MAPE is reported without a naive baseline, so the numbers float free. Every
model should be scored against "predict yesterday's value", and any model that
can't beat it should be flagged. This makes the forecasting story *more*
believable, not less.

### 4. Richer demand features
Feature engineering is currently a single time index. Day-of-week, month, lag
features and rolling means are cheap to add and materially improve the numbers —
and they're the difference between a demo and something worth trusting.

### 5. Streaming responses
Answers arrive all at once. Token streaming over SSE would make the assistant
feel like a product rather than a request-response form.

---

## The wider series

Same constraint — zero infrastructure cost, everything runnable locally —
applied to other architectures that usually assume the opposite.

| # | Project | The question it answers |
|---|---|---|
| **1** | **WarehouseOps AI** *(this repo)* | Can a multi-agent operations assistant with tool routing and guardrails run on free infrastructure? |
| **2** | **Document intelligence pipeline** | Can a full extract → validate → route → human-review loop work without a paid document AI service? Contracts and invoices in, structured records out, with a reviewer queue for anything low-confidence. |
| **3** | **Retrieval evaluation harness** | Most RAG demos never measure retrieval quality. A harness that scores recall@k, reranking gain and answer faithfulness on your own corpus, so "we added RAG" becomes a number. |
| **4** | **Time-series forecasting service** | Forecasting as a service rather than a notebook: versioned models, backtests against naive baselines, drift detection, and an API that returns intervals rather than point estimates. |
| **5** | **Agent observability** | Traces for agent systems — which agent ran, which tools it called, what it retrieved, what it cost, and where it went wrong. The thing every agent demo skips. |

If one of these is more useful to you than the others, say so in an issue — the
order isn't fixed.

---

## Contributing

Bug reports from people who ran this on **real warehouse data** are the most
valuable thing I can get. The sample dataset is synthetic and well-behaved;
yours won't be. See [CONTRIBUTING.md](../CONTRIBUTING.md).
