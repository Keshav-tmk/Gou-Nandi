
import math
from typing import Any


def extract_sensor_features(sensors: dict[str, Any]) -> dict[str, float]:
    """
    Extract basic movement features from accelerometer
    and gyroscope sensor readings.

    Accelerometer unit: g
    Gyroscope unit: degrees per second
    """

    # Read accelerometer values
    ax = float(sensors["accel_x"])
    ay = float(sensors["accel_y"])
    az = float(sensors["accel_z"])

    # Read gyroscope values
    gx = float(sensors["gyro_x"])
    gy = float(sensors["gyro_y"])
    gz = float(sensors["gyro_z"])

    # Calculate total acceleration magnitude
    acceleration_magnitude = math.sqrt(
        ax**2 + ay**2 + az**2
    )

    # Calculate total rotational movement
    gyroscope_magnitude = math.sqrt(
        gx**2 + gy**2 + gz**2
    )

    # Estimate acceleration beyond gravity
    dynamic_acceleration = abs(
        acceleration_magnitude - 1.0
    )

    # Return the extracted features
    return {
        "acceleration_magnitude_g": round(
            acceleration_magnitude, 4
        ),
        "gyroscope_magnitude_dps": round(
            gyroscope_magnitude, 4
        ),
        "dynamic_acceleration_g": round(
            dynamic_acceleration, 4
        ),
    }


# Test the feature extraction function
if __name__ == "__main__":

    sample = {
        "accel_x": 0.8735,
        "accel_y": 0.0303,
        "accel_z": 0.4780,
        "gyro_x": -1.4504,
        "gyro_y": -2.3359,
        "gyro_z": -1.2748,
    }

    print("Input sensor readings:")
    print(sample)

    features = extract_sensor_features(sample)

    print("\nExtracted sensor features:")

    for name, value in features.items():
        print(f"{name}: {value}")
