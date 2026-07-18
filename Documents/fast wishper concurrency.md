# faster-whisper Concurrency Options — AI Audit Project

> **Current config**: CPU shared mode, `concurrency=3` (as of 2026-07-14)
> **Model**: `tiny` (fastest, lowest memory, effective for call center audio)

---

## The Three Deployment Strategies

---

### Option A — Full GPU (STT-Dedicated GPU Instance)
> Best if you add a second GPU or dedicate the full GPU to STT only.

**How it works:**
- `worker-stt` runs faster-whisper with `device=cuda`, `compute_type=float16`
- Each worker instance loads the tiny model into VRAM (~300 MB per instance)
- vLLM is disabled or moved to a second GPU

**Configuration (`docker-compose.yml`):**
```yaml
worker-stt:
  command: celery -A app.core.celery_app worker -Q stt_queue --loglevel=info --concurrency=4 -E
  environment:
    - WHISPER_DEVICE=cuda
    - WHISPER_COMPUTE_TYPE=float16
  runtime: nvidia
```

**Performance (RTX 5060 Ti 16 GB, tiny model):**
| Metric | Value |
|---|---|
| VRAM per instance | ~300 MB |
| Max safe concurrency | 8–10 instances |
| Transcription speed | ~80x real-time |
| 5-min call audio | ~3–4 seconds |

**Pros:**
- Absolute fastest transcription
- GPU handles audio + LLM (if vLLM on same GPU, time-sliced)
- Scales well with more concurrent uploads

**Cons:**
- Competes with vLLM for VRAM (risky on single 16 GB GPU)
- VRAM spikes during simultaneous vLLM + Whisper inference can cause OOM
- Not recommended on single-GPU setup with vLLM at 85% utilization

---

### Option B — Shared GPU + CPU (Current Recommended Setup)
> Best for single-GPU setups running vLLM simultaneously. **This is what is currently deployed.**

**How it works:**
- `worker-stt` runs faster-whisper on **CPU** with `compute_type=int8`
- vLLM keeps full GPU ownership (85% VRAM reserved)
- STT workers run in parallel on CPU threads — no GPU competition

**Configuration (`docker-compose.yml`):**
```yaml
worker-stt:
  command: celery -A app.core.celery_app worker -Q stt_queue --loglevel=info --concurrency=3 -E
  environment:
    - WHISPER_DEVICE=cpu
    - WHISPER_COMPUTE_TYPE=int8
```

**Performance (CPU int8, tiny model, 6-core WSL2 allocation):**
| Metric | Value |
|---|---|
| RAM per instance | ~75 MB |
| Max safe concurrency | 3–4 instances |
| Transcription speed | ~15–25x real-time |
| 5-min call audio | ~12–20 seconds |
| 3 files simultaneously | all 3 done in ~20s, then hit vLLM together |

**Pros:**
- vLLM gets full GPU → faster, higher-quality LLM responses
- 3 files transcribe simultaneously without any VRAM pressure
- vLLM receives batched requests → better GPU utilization
- Safe and stable on any single-GPU setup
- tiny model on CPU int8 is still very fast for call audio

**Cons:**
- Slightly slower per-file transcription vs full GPU mode
- CPU-bound: adding more workers beyond 4 won't help much

---

### Option C — Full GPU Shared (vLLM + Whisper on same GPU, time-sliced)
> Experimental. Only attempt if you need maximum throughput and accept some instability.

**How it works:**
- Both vLLM AND worker-stt run on CUDA simultaneously
- GPU time-slices between Whisper and vLLM requests
- VRAM must fit both: vLLM (~13.6 GB at 85%) + Whisper tiny × N instances (~300 MB each)

**Configuration (`docker-compose.yml`):**
```yaml
vllm:
  environment:
    - VLLM_WSL2_ENABLE_PIN_MEMORY=1
  # Keep gpu_memory_utilization at 0.75 (NOT 0.85) to leave room
  command: >
    "... --gpu-memory-utilization 0.75 ..."

worker-stt:
  command: celery -A app.core.celery_app worker -Q stt_queue --loglevel=info --concurrency=2 -E
  environment:
    - WHISPER_DEVICE=cuda
    - WHISPER_COMPUTE_TYPE=float16
  runtime: nvidia
```

**Performance (RTX 5060 Ti 16 GB):**
| Metric | Value |
|---|---|
| vLLM VRAM | ~12 GB (at 75%) |
| Remaining VRAM | ~4 GB |
| Whisper instances | 2 max (safe) |
| Transcription speed | ~80x real-time |
| Risk level | Medium — OOM possible during simultaneous peak load |

**Pros:**
- Fast STT AND fast LLM
- GPU fully utilized across both workloads

**Cons:**
- Requires tuning vLLM `gpu_memory_utilization` down to 0.75
- OOM risk if vLLM KV cache spikes during long calls
- WSL2 adds additional memory pressure
- Harder to debug crashes

---

## Decision Matrix

| Scenario | Recommended Option |
|---|---|
| Single GPU (current setup) | **Option B — Shared CPU** |
| Dual GPU available | **Option A — Full GPU** |
| Maximum throughput, accept risk | **Option C — Full GPU Shared** |
| Production stability priority | **Option B — Shared CPU** |

---

## Current Active Config Summary

```
Model:        faster-whisper tiny
Device:       CPU (int8)
Concurrency:  3 parallel workers
STT Speed:    ~15–25x real-time
vLLM:         Full GPU (85% VRAM)
GPU:          RTX 5060 Ti 16 GB (Blackwell, compute 10.0)
```

To switch options, update `WHISPER_DEVICE`, `WHISPER_COMPUTE_TYPE`, and `--concurrency`
in `docker-compose.yml` under the `worker-stt` service, then run:

```powershell
docker compose up -d --no-deps --build worker-stt
```
