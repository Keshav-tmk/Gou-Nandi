"""Smart Livestock Monitoring AI Module.

Provides hardware-compatible feature extraction, behaviour classification,
anomaly detection, and real-time inference services.
"""

from src.ai.feature_extraction import (
    HardwareFeatureExtractor,
    FeatureExtractionResult,
    FEATURE_NAMES,
    PHYSICAL_CHANNELS,
)

__all__ = [
    "HardwareFeatureExtractor",
    "FeatureExtractionResult",
    "FEATURE_NAMES",
    "PHYSICAL_CHANNELS",
]
