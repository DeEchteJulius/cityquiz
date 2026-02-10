# CityQuiz

CityQuiz is an offline-first geography quiz game focused on **naming cities and places from memory**, with an emphasis on **accurate geographic structure**, **multilingual support**, and **data-driven quiz modes**.

This repository contains both the **game engine** and the **data pipeline** used to build and maintain the world city dataset.

---

## Core Design Philosophy

CityQuiz is built around three key principles:

1. **Geographic correctness**
   - Real administrative hierarchies
   - Country-specific admin naming (state / province / prefecture, etc.)
   - Proper handling of capitals and subdivisions

2. **Data-driven gameplay**
   - No hardcoded country logic
   - Quiz modes defined entirely in data
   - The same engine works for every country

3. **Respect for language and scripts**
   - Native names, exonyms, transliterations, and historical names
   - Script-aware matching (Latin, Arabic, Cyrillic, etc.)
   - Players are rewarded for multilingual knowledge

---

## Architecture Overview

CityQuiz uses a **two-layer data architecture**:




### Why this approach?
- SQLite is used to **clean, enrich, normalize, and relate data**
- JSON is used at runtime because it is:
  - fast
  - portable
  - easy to bundle offline
  - predictable for the game engine

The game never edits data directly — it only consumes exported JSON.

---

## Database Schema (Authoring Layer)

### Core Tables

#### `places`
Stores all places worldwide (cities, towns, villages, etc.).

Key fields:
- `name`
- `name_norm`
- `place_type`
- `latitude`, `longitude`
- `population`
- `continent`
- `admin_0` … `admin_4` (codes, not names)
- `data_status` (`raw`, `partial`, `complete`, `blocked`)

This is the **main world table** (1M+ rows target).

---

#### `admin_units`
Lookup table for all administrative units.

- Resolves admin codes → names
- Supports translations and alternative names

Includes:
- `code`
- `level`
- `parent_code`
- `name_default`
- `name_local`
- `alt_names_json`

This table replaces all hardcoded subdivision lists.

---

#### `place_capitals`
Handles places with **multiple capital roles**.

- One row per `(place_id, admin_level)`
- Supports national + regional capitals cleanly

---

#### `place_alt_names`
Stores alternative names for places with metadata.

Each alt name can include:
- `name`
- `lang` (ISO / BCP 47)
- `script` (ISO 15924)
- `type` (`official`, `local`, `exonym`, `historical`, `romanization`, etc.)

This enables:
- multilingual matching
- script-aware detection
- future UI features (“you named that in Italian!”)

---

### Quiz Mode Tables

#### `quiz_modes`
Defines playable quiz modes (e.g. country modes).

- `id`
- `mode_type` (`country`, `continent`, `custom`)
- `title`, `description`
- `is_enabled`

---

#### `quiz_mode_countries`
Links quiz modes to one or more countries (`admin_0`).

This allows:
- single-country modes
- multi-country packs
- future regional modes

---

#### `quiz_mode_rules`
Defines gameplay filters for a mode.

Examples:
- allowed place types
- population thresholds
- capitals-only modes

---

#### `quiz_mode_map_config`
Stores map rendering metadata for each quiz mode.

Includes:
- projection type (e.g. `geoMercator`, `geoAlbers`)
- projection parameters (JSON)
- GeoJSON asset reference

This keeps **presentation decisions out of code** and out of place data.

---

## Runtime Data (Game Engine Layer)

At build time, SQLite data is exported into **lean, read-only JSON**:




The game engine:
- loads only the data it needs
- applies quiz mode rules
- resolves admin names dynamically
- never mutates data

---

## Matching & Language Awareness

CityQuiz’s matcher:
- normalizes user input
- matches against:
  - primary names
  - all alternative names
- tracks **which alt name matched**

This enables features like:
- detecting the language/script used
- rewarding multilingual answers
- future “language stats” per session

Example feedback:
> “Nice — you named that in Italian 🇮🇹”

---

## Current Focus (In Progress)

### ✅ Data pipeline is established
- SQLite authoring database
- Import via staging tables
- Export to runtime JSON

### 🚧 Actively working on
- Completing **Croatia** as the first fully “gold standard” country
- Populating `admin_units` with correct admin names
- Exporting admin names into JSON format
- Verifying capital roles and admin labels

This step validates the **entire end-to-end pipeline**.

---

## Roadmap (High-Level)

### Phase 1 — Pipeline Validation
- Finish Croatia (`data_status = complete`)
- Export and load into CityQuiz
- Confirm quiz mode works end-to-end

### Phase 2 — Complex Country Stress Test
- Continue Iran (province by province)
- Validate transliteration, alt names, deep admin levels
- Test multilingual matching logic

### Phase 3 — Scale-Up
- Add more “clean” countries (EU, Japan, etc.)
- Begin bulk imports
- Optimize matching indexes

### Phase 4 — Advanced Modes
- Continent modes
- Capitals-only modes
- Difficulty tiers

### Phase 5 — UX Enhancements
- Language-aware feedback
- Script-based achievements
- Detailed session stats

---

## Non-Goals (Important)

CityQuiz intentionally does **not**:
- display all cities at once (not a visualization tool)
- hardcode country logic
- query SQLite directly at runtime (for now)

The focus is **memory, knowledge, and structure**, not raw data display.

---

## Status

CityQuiz is currently in **active development**, with core architecture locked in and data production underway.

The project is intentionally designed to scale from a few countries to the entire world without changing the game engine.

---



