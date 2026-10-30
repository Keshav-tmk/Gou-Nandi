#ifndef SENSOR_PINS_H
#define SENSOR_PINS_H

/**
 * Sensor Pin and Hardware Configuration for Smart Livestock Collar
 * Target Animal: Lakshmi (COW-001)
 * Hardware: ESP32-WROOM-32
 */

// I2C Bus for MPU-6050 / BNO055 IMU
#define I2C_SDA_GPIO        21
#define I2C_SCL_GPIO        22
#define I2C_CLOCK_SPEED_HZ  400000  // Fast mode

// DS18B20 OneWire Temperature Probe
#define ONEWIRE_TEMP_GPIO   4

// Battery Voltage Monitoring (Analog ADC)
#define BATTERY_ADC_GPIO    34
#define VOLTAGE_DIVIDER_R1  100000.0f  // 100k
#define VOLTAGE_DIVIDER_R2  100000.0f  // 100k

// Diagnostic Status LED
#define STATUS_LED_GPIO     2

// Sampling Parameters
#define SENSOR_SAMPLING_RATE_HZ   10.0f
#define SENSOR_SAMPLE_INTERVAL_MS 100
#define BATCH_TRANSMIT_SIZE       20
#define BATCH_INTERVAL_MS         2000

#endif // SENSOR_PINS_H
