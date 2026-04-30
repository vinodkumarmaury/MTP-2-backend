# MCIF Backend — API Server v3.0

Express.js + MongoDB REST API for the **Mine Competitive Index Framework
 (MCIF)** — an analytical scoring engine for Indian opencast coal mines.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 4.x |
| Database | MongoDB (via Mongoose 8.x) |
| Config | dotenv |

## Project Structure

```
MTP-2-backend/
├── server.js              # Entry point — Express app, DB connection, health/stats routes
├── routes/
│   ├── predict.js         # POST /api/predict, GET /api/predict/from-db/:mine_id
│   ├── mines.js           # CRUD for mine reference documents
│   ├── history.js         # Prediction history queries
│   ├── compare.js         # Multi-mine comparison (radar chart data)
│   └── sensitivity.js     # OAT sensitivity analysis (±10/20/30%)
├── models/
│   ├── Mine.js            # Mongoose schema — 150+ mine parameters + actual_scores
│   └── Prediction.js      # Mongoose schema — saved prediction records
├── utils/
│   └── scoring.js         # computeMCI() — all dimension formulas + ensemble weights
├── data/
│   └── seed.js            # Seeds 12 reference mines (9 train + 3 validate) from Excel data
└── .env                   # Environment variables (not committed)
```

## Environment Variables

Create a `.env` file in this directory:

```env
MONGO_URL=mongodb://localhost:27017/MCIF
PORT=8000
```

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URL` | `mongodb://localhost:27017/MCIF` | MongoDB connection string |
| `PORT` | `8000` | HTTP port |

For MongoDB Atlas: `MONGO_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/MCIF`

## Setup & Run

```bash
# Install dependencies
npm install

# Seed the database with 12 reference mines
npm run seed

# Development (auto-reload)
npm run dev

# Production
npm start
```

## API Endpoints

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health ping — returns version |
| GET | `/api/health` | DB connection status + model info |
| GET | `/api/stats` | Aggregate stats (predictions count, grade breakdown, avg MCI) |

### Prediction

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predict` | Run MCI prediction from submitted params |
| GET | `/api/predict/from-db/:mine_id` | Run prediction using all params stored for a reference mine |

**POST `/api/predict` body:**
```json
{
  "params": { "npv": 120, "irr": 14.5, "osr": 3.2, ... },
  "mine_name": "My Mine",
  "mine_ref": "MINE_010",
  "input_mode": "core",
  "session_label": "Run 1"
}
```

**Response:**
```json
{
  "prediction_id": "<mongo_id>",
  "results": {
    "mci": 67.3,
    "grade": "B",
    "dimension_scores": { "technical": 72, "economic": 65, ... },
    "subtopic_scores": { "hemm_cost": 68, "infrastructure": 71, ... },
    "weights": { "technical": 0.127, "economic": 0.170, ... },
    "valuation_method": "DCF / NPV / IRR"
  },
  "comparison": {
    "has_actual": true,
    "actual_mci": 62.8,
    "errors": {
      "mci": { "predicted": 67.3, "actual": 62.8, "diff": 4.5, "pct": 7.2 },
      "technical": { ... },
      ...
    },
    "predicted_subtopic_scores": { ... }
  }
}
```

### Mines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mines` | List all reference mines |
| GET | `/api/mines/:mine_id` | Get single mine document |
| POST | `/api/mines` | Add a new mine |
| PUT | `/api/mines/:mine_id` | Update mine parameters |
| DELETE | `/api/mines/:mine_id` | Delete a mine |

### History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | All saved predictions (paginated) |
| GET | `/api/history/:id` | Single prediction by ID |
| DELETE | `/api/history/:id` | Delete a prediction record |

### Compare & Sensitivity

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/compare` | Compare multiple mines — returns radar chart data |
| POST | `/api/sensitivity` | OAT sensitivity: vary one param ±10/20/30%, return MCI deltas |

## Scoring Model

`utils/scoring.js` implements the full analytical MCIF v3.0 pipeline:

- **7 dimensions:** Technical, Economic, Environmental, Social, Geographical, Governance, Risk
- **Ensemble weights** (AHP 50% + EWM 30% + CRITIC 20%):

| Dimension | Weight |
|-----------|--------|
| Technical | 12.7% |
| Economic | 17.0% |
| Environmental | 10.1% |
| Social | 13.9% |
| Geographical | 13.0% |
| Governance | 6.6% |
| Risk (Safety Quality) | 26.7% |

- **MCI formula:** `MCI = (0.127T + 0.170E + 0.101Env + 0.139S + 0.130G + 0.066Gov + 0.267R) × 0.87`
- Risk is scored as **Safety Quality = 100 − hazard_level** (positive contribution)
- Model MAE ≈ 2.53 pts on 3 validation mines

## Grade Thresholds

| Grade | MCI Range | Interpretation |
|-------|-----------|---------------|
| A | 80–100 | Excellent — Investment grade |
| B | 65–79 | Good — Viable |
| C | 50–64 | Marginal — Staged investment |
| D | < 50 | High Risk — Remediation required |

## Reference Mines

12 real Indian OC coal mines are seeded into MongoDB:
- **9 training mines** (MINE_001 – MINE_009): used for weight derivation
- **3 validation mines** with known actual scores:
  - `MINE_010` — Rajmahal OCP (Grade C, MCI 58.4)
  - `MINE_011` — BCCL N.Karanpura (Grade D, MCI 48.2)
  - `MINE_012` — Lajkura OCP (Grade C, MCI 62.8)

## Notes

- MongoDB must be running before starting the server. The server exits on connection failure.
- Prediction history saves are **non-blocking** — API returns results even if MongoDB is temporarily unavailable.
- No ML model file needed — scoring is fully analytical (formula-based).
