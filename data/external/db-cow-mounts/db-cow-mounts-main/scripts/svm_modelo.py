import pandas as pd
from sklearn.feature_selection import SequentialFeatureSelector
import numpy as np
import os
from scipy.signal import find_peaks
from scipy.stats import kurtosis, skew
from sklearn.model_selection import train_test_split, cross_val_score, RepeatedStratifiedKFold
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.utils import shuffle
from scipy.fft import fft
from datetime import timedelta
import matplotlib.pyplot as plt
from sklearn.inspection import permutation_importance
from sklearn.model_selection import GridSearchCV

# Función para extraer características de una señal
def extract_features(signal, sample_rate=10):

    features = {}
    
# Características en el dominio del tiempo
    features['mean'] = np.mean(signal)
    features['median'] = np.median(signal)
    features['std_dev'] = np.std(signal)
    features['zero_crossing_rate'] = ((np.diff(np.sign(signal)) != 0).sum()) / len(signal)
    features['peak_to_peak'] = np.ptp(signal)
    features['sum'] = np.sum(signal)
    features['sum_abs'] = np.sum(np.abs(signal))
    features['rms'] = np.sqrt(np.mean(signal ** 2))
    features['mean_acceleration_variation'] = np.mean(np.abs(np.diff(signal)))
    features['skewness'] = skew(signal)
    features['kurtosis'] = kurtosis(signal)

    # Características en el dominio de la frecuencia
    fft_values = np.abs(fft(signal))
    features['dominant_frequency'] = np.argmax(fft_values)
    features['psd_energy'] = np.sum(np.abs(fft_values) ** 2) / len(signal)

    # Tiempo promedio entre peaks máximos
    peaks, _ = find_peaks(signal)
    if len(peaks) > 1:
        peak_intervals = np.diff(peaks) / sample_rate
        features['avg_time_between_peaks'] = np.mean(peak_intervals)
    else:
        features['avg_time_between_peaks'] = 0

    return features


#extraer caracteristicas
def process_csv_files(directory, label, time_limit=None):
    all_features = []
    for filename in os.listdir(directory):
        if filename.endswith('.csv'):
            file_path = os.path.join(directory, filename)
            data = pd.read_csv(file_path)
            
            # Columnas
            arz_data = data['BNO055_az_world']
            arx_data = data['BNO055_ax_world']
            ary_data = data['BNO055_ay_world']
            gx_data = data['BNO055_GX']
            gy_data = data['BNO055_GY']
            gz_data = data['BNO055_GZ']
            
            # Calcular módulos de aceleración y giroscopio
            acceleration_module = np.sqrt(arx_data**2 + ary_data**2 + arz_data**2)
            gyroscope_module = np.sqrt(gx_data**2 + gy_data**2 + gz_data**2)
            
            # Considerar ventana de tiempo
            if time_limit:
                end_idx = int(time_limit * 10)  # Suponiendo fs = 10 Hz
                arz_data = arz_data[:end_idx]
                arx_data = arx_data[:end_idx]
                ary_data = ary_data[:end_idx]
                gx_data = gx_data[:end_idx]
                gy_data = gy_data[:end_idx]
                gz_data = gz_data[:end_idx]
                acceleration_module = acceleration_module[:end_idx]
                gyroscope_module = gyroscope_module[:end_idx]
            
            # Extraer características para cada eje y módulo
            features_z = extract_features(arz_data)
            features_x = extract_features(arx_data)
            features_y = extract_features(ary_data)
            features_gx = extract_features(gx_data)
            features_gy = extract_features(gy_data)
            features_gz = extract_features(gz_data)
            features_acc_module = extract_features(acceleration_module)
            features_gyro_module = extract_features(gyroscope_module)
            
            # Combinar todas las características
            features = {
                **{'Z_' + k: v for k, v in features_z.items()},
                **{'X_' + k: v for k, v in features_x.items()},
                **{'Y_' + k: v for k, v in features_y.items()},
                **{'GX_' + k: v for k, v in features_gx.items()},
                **{'GY_' + k: v for k, v in features_gy.items()},
                **{'GZ_' + k: v for k, v in features_gz.items()},
                **{'ACC_MODULE_' + k: v for k, v in features_acc_module.items()},
                **{'GYRO_MODULE_' + k: v for k, v in features_gyro_module.items()},
            }
            features['label'] = label
            all_features.append(features)
    return pd.DataFrame(all_features)

# Directorios
directory_monta_activa = 'C:/Users/piwe_/OneDrive/Escritorio/verano_paper/proyecto/7seg/dataset_7seg/active mount'



import random



# Tiempo límite para segmentar (en segundos)
time_limit = 7
# Procesar los datos
features_df_monta_activa = process_csv_files(directory_monta_activa, label=1, time_limit=time_limit)

# Directorio base de "no montas"
directory_no_monta = "C:\\Users\\piwe_\\OneDrive\\Escritorio\\verano_paper\\proyecto\\7seg\\dataset_7seg\\no_montas"

# Lista para almacenar los DataFrames de cada movimiento de no montas
all_no_monta_dfs = {}

# Número de muestras a tomar por movimiento
sample_counts = {
    "head nodding": 6,
    "walking": 5,
    "grazing": 5,
    "resting": 5
}



# Recorre cada subcarpeta dentro de la carpeta "no_montas"
for subfolder in os.listdir(directory_no_monta):
    subfolder_path = os.path.join(directory_no_monta, subfolder)

    if os.path.isdir(subfolder_path):  # Verifica si es una carpeta
        print(f"Procesando carpeta: {subfolder_path}")

        # Procesa los CSV dentro de esta subcarpeta
        movement_dfs = process_csv_files(subfolder_path, label=0, time_limit=time_limit)

        # Asegurar que movement_dfs no esté vacío antes de agregarlo
        if not movement_dfs.empty:
            all_no_monta_dfs[subfolder] = movement_dfs
        else:
            print(f"Advertencia: No se encontraron datos válidos en {subfolder_path}")

# Aplicar balanceo: seleccionar muestras aleatorias de cada movimiento
balanced_dfs = []

for movement, sample_count in sample_counts.items():
    if movement in all_no_monta_dfs:
        movement_df = all_no_monta_dfs[movement]
        if len(movement_df) > sample_count:
            movement_df = movement_df.sample(n=sample_count, random_state=42)  # Selección aleatoria
        balanced_dfs.append(movement_df)

# Verificar si se han recopilado datos balanceados
if balanced_dfs:
    features_df_no_monta = pd.concat(balanced_dfs, ignore_index=True)
else:
    raise ValueError("No hay DataFrames válidos en all_no_monta_dfs después del balanceo.")



# Combinar y mezclar datos
features_df_total = pd.concat([features_df_monta_activa, features_df_no_monta])
features_df_total = shuffle(features_df_total, random_state=42)



# Verificar tamaño y distribución de datos
print("Distribución de clases:")
print(features_df_total['label'].value_counts())

# Separar características y etiquetas
X = features_df_total.drop('label', axis=1)
y = features_df_total['label']


# Definir los hiperparámetros que quieres optimizar
param_grid = {
    'svm__C': [0.1, 1, 10, 100],  # Parámetro de penalización
    'svm__gamma': ['scale', 'auto'],  # Coeficiente del kernel (específico para ciertos kernels)
}


# Crear Pipeline con solo el modelo SVM
pipeline = Pipeline([
    ('svm', SVC(kernel='linear', random_state=42))
])



# Usar GridSearchCV para buscar los mejores hiperparámetros
grid_search = GridSearchCV(pipeline, param_grid, cv=5, scoring='f1', n_jobs=-1, verbose=1)

# Ajustar el modelo
grid_search.fit(X, y)

best_params = grid_search.best_params_
# Mostrar los mejores hiperparámetros y el mejor score
print(f"Mejores hiperparámetros: {grid_search.best_params_}")
print(f"Mejor F1 Score: {grid_search.best_score_:.3f}")


cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=20, random_state=42)

# Usar cross_val_score para la validación cruzada con F1-Score
f1_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='f1')
accuracy_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='accuracy')
precision_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='precision')
recall_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='recall')




# Resultados de validación cruzada

print(f"Accuracy en cada pliegue: {[f'{score:.3f}' for score in accuracy_scores]}")
print(f"Accuracy promedio: {np.mean(accuracy_scores):.3f}\n")

print(f"Precision en cada pliegue: {[f'{score:.3f}' for score in precision_scores]}")
print(f"Precision promedio: {np.mean(precision_scores):.3f}\n")

print(f"Recall en cada pliegue: {[f'{score:.3f}' for score in recall_scores]}")
print(f"Recall promedio: {np.mean(recall_scores):.3f}\n")

print(f"F1 Scores en cada pliegue: {[f'{score:.3f}' for score in f1_scores]}")
print(f'F1 Score promedio en validación cruzada: {np.mean(f1_scores)}')


# Evaluar en conjunto separado
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_test)

# Extraer el modelo SVM del pipeline
svm_model = pipeline.named_steps['svm']

# Métricas finales
accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
conf_matrix = confusion_matrix(y_test, y_pred)

print(f'\nEvaluación final en conjunto de prueba:')
print(f'Exactitud: {accuracy}')
print(f'Precisión: {precision}')
print(f'Recall (Sensibilidad): {recall}')
print(f'F1-Score: {f1}')
print(f'Matriz de Confusión:\n{conf_matrix}')

# Ordenar las características por su peso en el modelo SVM
if svm_model.kernel == 'linear':
    feature_weights = pd.DataFrame({
        'Feature': X.columns,
        'Weight': np.abs(svm_model.coef_[0])
    }).sort_values(by='Weight', ascending=False)
    
    print("\nCaracterísticas ordenadas por importancia:")
    print(feature_weights)

# Función para convertir índices de muestras a tiempo (hora, minuto, segundo)
def index_to_time(base_time, index, sample_rate=10):
    elapsed_time = timedelta(seconds=index / sample_rate)
    return (base_time + elapsed_time).strftime('%H:%M:%S')



# Función para aplicar la ventana deslizante y clasificar cada fragmento
def sliding_window_classification(model, arz_data, arx_data, ary_data, gx_data, gy_data, gz_data, timestamps, window_size=110, step_size=10):
    results = []
    base_time = pd.to_datetime(timestamps.iloc[0])  # Primer valor de tiempo
    # Recorrer la señal con la ventana deslizante
    for start in range(0, len(arz_data) - window_size, step_size):
        window_z = arz_data[start:start + window_size]
        window_x = arx_data[start:start + window_size]
        window_y = ary_data[start:start + window_size]
        window_gx = gx_data[start:start + window_size]
        window_gy = gy_data[start:start + window_size]
        window_gz = gz_data[start:start + window_size]
        
        # Calcular módulos de la ventana
        acceleration_module = np.sqrt(window_x**2 + window_y**2 + window_z**2)
        gyroscope_module = np.sqrt(window_gx**2 + window_gy**2 + window_gz**2)
        
        # Extraer características de las señales y los módulos
        features_z = extract_features(window_z)
        features_x = extract_features(window_x)
        features_y = extract_features(window_y)
        features_gx = extract_features(window_gx)
        features_gy = extract_features(window_gy)
        features_gz = extract_features(window_gz)
        features_acc_module = extract_features(acceleration_module)
        features_gyro_module = extract_features(gyroscope_module)

        # Combinar las características de todos los ejes y módulos
        features = {
            **{'Z_' + k: v for k, v in features_z.items()},
            **{'X_' + k: v for k, v in features_x.items()},
            **{'Y_' + k: v for k, v in features_y.items()},
            **{'GX_' + k: v for k, v in features_gx.items()},
            **{'GY_' + k: v for k, v in features_gy.items()},
            **{'GZ_' + k: v for k, v in features_gz.items()},
            **{'ACC_MODULE_' + k: v for k, v in features_acc_module.items()},
            **{'GYRO_MODULE_' + k: v for k, v in features_gyro_module.items()},
        }
        # Convertir a DataFrame para que coincida con el formato del modelo
        features_df = pd.DataFrame([features])
        
        # Clasificar la ventana
        prediction = model.predict(features_df.values)[0]
        
        # Convertir el índice a tiempo real
        start_time = index_to_time(base_time, start)
        end_time = index_to_time(base_time, start + window_size)
        
        results.append({
            'start_time': start_time,
            'end_time': end_time,
            'prediction': prediction
        })
    
    return pd.DataFrame(results)  # Retornar los resultados como un DataFrame

# Función para realizar SBS
def sequential_feature_selection(X, y):
    print("\n--- Iniciando Selección de Características con SBS (Sequential Backward Selection) ---\n")
    best_svc = SVC(kernel='linear', C=0.1, gamma='scale', random_state=42)
    selector = SequentialFeatureSelector(SVC(kernel='linear', random_state=42), n_features_to_select=20, direction='forward')
    selector.fit(X, y)
    selected_features = X.columns[selector.get_support()]
    
    # Mostrar las características seleccionadas por SBS en una lista hacia abajo
    print("\nCaracterísticas seleccionadas por SBS:")
    for feature in selected_features:
        print(f"  - {feature}")
    print()  # Salto de línea al final

    return selected_features

# Realizar SBS
selected_features = sequential_feature_selection(X, y)

# Filtrar solo las características seleccionadas
X_selected = X[selected_features]

# Crear Pipeline con escalado y modelo SVM
pipeline_sbs = Pipeline([
    ('scaler', StandardScaler()),
    ('svm', SVC(kernel='linear', random_state=42))
])

# Validación cruzada con las características seleccionadas por SBS
f1_scores_sbs = cross_val_score(pipeline_sbs, X_selected, y, cv=cv, scoring='f1')

# Resultados de validación cruzada
print(f"\nF1 Scores en cada pliegue con SBS: {[f'{score:.3f}' for score in f1_scores_sbs]}")
print(f"F1-Score promedio en validación cruzada con SBS: {np.mean(f1_scores_sbs):.3f}\n")


# Calcular otras métricas: exactitud, precisión y recall
accuracy_scores = cross_val_score(pipeline_sbs, X_selected, y, cv=cv, scoring='accuracy')
precision_scores = cross_val_score(pipeline_sbs, X_selected, y, cv=cv, scoring='precision')
recall_scores = cross_val_score(pipeline_sbs, X_selected, y, cv=cv, scoring='recall')

# Mostrar los resultados
print(f"Accuracy en cada pliegue con SBS: {[f'{score:.3f}' for score in accuracy_scores]}")
print(f"Accuracy promedio en validación cruzada con SBS: {np.mean(accuracy_scores):.3f}\n")

print(f"Precision en cada pliegue con SBS: {[f'{score:.3f}' for score in precision_scores]}")
print(f"Precision promedio en validación cruzada con SBS: {np.mean(precision_scores):.3f}\n")

print(f"Recall en cada pliegue con SBS: {[f'{score:.3f}' for score in recall_scores]}")
print(f"Recall promedio en validación cruzada con SBS: {np.mean(recall_scores):.3f}\n")

# Evaluación en conjunto separado con las características seleccionadas
X_train_sbs, X_test_sbs, y_train_sbs, y_test_sbs = train_test_split(X_selected, y, test_size=0.2, stratify=y, random_state=42)
pipeline_sbs.fit(X_train_sbs, y_train_sbs)
y_pred_sbs = pipeline_sbs.predict(X_test_sbs)

# Métricas finales
accuracy_sbs = accuracy_score(y_test_sbs, y_pred_sbs)
precision_sbs = precision_score(y_test_sbs, y_pred_sbs)
recall_sbs = recall_score(y_test_sbs, y_pred_sbs)
f1_sbs = f1_score(y_test_sbs, y_pred_sbs)
conf_matrix_sbs = confusion_matrix(y_test_sbs, y_pred_sbs)

print(f'\n--- Evaluación Final con SBS ---')
print(f"Exactitud: {accuracy_sbs:.3f}")
print(f"Precisión: {precision_sbs:.3f}")
print(f"Recall (Sensibilidad): {recall_sbs:.3f}")
print(f"F1-Score: {f1_sbs:.3f}\n")

# Mostrar la Matriz de Confusión
print("Matriz de Confusión:")
conf_matrix_df = pd.DataFrame(conf_matrix_sbs, columns=['Predicción 0', 'Predicción 1'], index=['Real 0', 'Real 1'])
print(conf_matrix_df)

# Permutación de la importancia de las características
pipeline_sbs.fit(X_train_sbs, y_train_sbs)
result_permutation = permutation_importance(pipeline_sbs, X_test_sbs, y_test_sbs, n_repeats=10, random_state=42)

# Graficar la importancia de las características
importances = result_permutation.importances_mean
indices = np.argsort(importances)[::-1]

# Graficar la importancia de las características
plt.figure(figsize=(10, 6))
plt.barh(range(len(selected_features)), importances[indices], align='center', color='royalblue')
plt.yticks(range(len(selected_features)), [selected_features[i] for i in indices])
plt.xlabel('Importancia Media por Permutación')
plt.title('Importancia de las Características por Permutación')
plt.tight_layout()  # Para que el gráfico no se corte
plt.show()




