# Livestock estrus and lameness baseline models

Files:
- `oestrus_day_random_forest.joblib`: trained baseline estrus-day classifier bundle
- `lameness_day_random_forest.joblib`: trained baseline lameness-day classifier bundle
- `oestrus_day_holdout_predictions.csv`: predictions for held-out cows
- `lameness_day_holdout_predictions.csv`: predictions for held-out cows
- `training_evaluation_summary.json`: dataset details, metrics, and limitations

## Important result
These are baseline models, not yet high-performing alert systems. Both datasets are severely imbalanced. The estrus model has low recall at threshold 0.5, and the lameness model detected no positive cases at that threshold. Accuracy alone is misleading.

## Data compatibility
The uploaded CSVs contain daily activity summaries (activity, rest/eating hours, hourly activity, baselines/deviations and event labels). They are not raw MPU-6050 accelerometer/gyroscope records. These models cannot be connected directly to raw MPU-6050 readings without a new sensor feature pipeline and compatible labelled training data.

## Next improvement
Tune the decision threshold using a validation split grouped by cow, then evaluate on untouched test cows. For better real-world generalisation, test on a farm not used for training if the dataset permits. Check event label definitions and data provenance before interpreting predictions as confirmed heat or lameness.
