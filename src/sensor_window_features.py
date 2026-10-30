import math
from statistics import mean, pstdev


def extract_window_features(sensor_readings):
    if not sensor_readings:
        raise ValueError("Sensor readings cannot be empty")

    acceleration_values = []
    gyroscope_values = []

    for sensors in sensor_readings:
        ax = float(sensors["accel_x"])
        ay = float(sensors["accel_y"])
        az = float(sensors["accel_z"])

        gx = float(sensors["gyro_x"])
        gy = float(sensors["gyro_y"])
        gz = float(sensors["gyro_z"])

        acceleration = math.sqrt(ax**2 + ay**2 + az**2)
        gyroscope = math.sqrt(gx**2 + gy**2 + gz**2)

        acceleration_values.append(acceleration)
        gyroscope_values.append(gyroscope)

    return {
        "reading_count": len(sensor_readings),
        "acceleration_mean_g": round(mean(acceleration_values), 4),
        "acceleration_min_g": round(min(acceleration_values), 4),
        "acceleration_max_g": round(max(acceleration_values), 4),
        "acceleration_variation_g": round(pstdev(acceleration_values), 4),
        "gyroscope_mean_dps": round(mean(gyroscope_values), 4),
        "gyroscope_min_dps": round(min(gyroscope_values), 4),
        "gyroscope_max_dps": round(max(gyroscope_values), 4),
        "gyroscope_variation_dps": round(pstdev(gyroscope_values), 4),
    }


if __name__ == "__main__":
    sample_readings = [
        {
            "accel_x": 0.8735,
            "accel_y": 0.0303,
            "accel_z": 0.4780,
            "gyro_x": -1.4504,
            "gyro_y": -2.3359,
            "gyro_z": -1.2748,
        },
        {
            "accel_x": 0.9000,
            "accel_y": 0.0500,
            "accel_z": 0.4300,
            "gyro_x": 2.1000,
            "gyro_y": -1.5000,
            "gyro_z": 0.8000,
        },
        {
            "accel_x": 0.8500,
            "accel_y": 0.0800,
            "accel_z": 0.5000,
            "gyro_x": 4.0000,
            "gyro_y": 2.0000,
            "gyro_z": -1.0000,
        },
        {
            "accel_x": 0.9200,
            "accel_y": 0.0400,
            "accel_z": 0.3900,
            "gyro_x": -0.5000,
            "gyro_y": 1.2000,
            "gyro_z": 0.6000,
        },
        {
            "accel_x": 0.8800,
            "accel_y": 0.0600,
            "accel_z": 0.4600,
            "gyro_x": 1.0000,
            "gyro_y": -2.0000,
            "gyro_z": 1.5000,
        },
    ]

    features = extract_window_features(sample_readings)

    print("Window-based sensor features:")
    for name, value in features.items():
        print(f"{name}: {value}")