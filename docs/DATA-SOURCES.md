# Kotaana data sources

## Exercise data

The supplied integration pack includes prepared exercise datasets derived from:

- yuhonas/free-exercise-db
- bryllim/workout-guide
- mohamedatef/exercise-dataset
- Kotaana-curated baseline movements used only for verified stretch, warm-up, core and outdoor coverage.

The app stores source, verified status, safety tags, contraindications, equipment and other metadata in the database. The runtime workout engine only selects verified database exercises; it does not silently invent exercises.

## Food data

The supplied pack includes prepared USDA FoodData Central Foundation and SR Legacy data. Open Food Facts is optional and is not required for the core product.

## Runtime weather

Nutrition hydration adjustments can use Open-Meteo when network access is available. The app continues with a conservative baseline when weather data is unavailable.

## Licensing / production review

Before commercial launch, confirm and record the current license/terms for every redistributed dataset and any supplemental source added to the seed pipeline. Keep source attribution with each imported dataset.
