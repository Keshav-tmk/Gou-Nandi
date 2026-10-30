#db-cow-mounts - Base de datos de monta activa, reposo, caminata, cabeceo y pastoreo.

Esta invención consiste en una base de datos desarrollada en el marco del proyecto Fondecyt 1220178, orientada específicamente a la detección de montas activas en bovinos, uno de los tantos comportamientos característicos en la identificación del periodo de celo en vacas. Las vacas en estudio se encuentran en el campo experimental Maquehue y se alimentan a pastoreo libre.

La base de datos incluye registros procesados de mediciones obtenidas mediante sensores inerciales IMU BNO055 y MPU9250. En el caso de la BNO055, se capturan aceleraciones lineales en los tres ejes tanto en el marco de referencia del cuerpo (Body Frame) como en el terrestre (World Frame), además de velocidades angulares, datos de magnetómetro y orientación representada en cuaterniones. Por su parte, la MPU9250 proporciona aceleraciones lineales, velocidades angulares y mediciones del campo magnético en los tres ejes.

Cada tipo de movimiento cuenta con su propia carpeta, dentro de la cual se encuentran múltiples archivos CSV que almacenan fragmentos de señal correspondientes a distintos eventos. Estos archivos son de duración variable, ya que abarcan el periodo completo desde el inicio hasta el fin de cada movimiento etiquetado. En total, la base de datos contiene 415 etiquetas obtenidas a partir del seguimiento de ocho vacas.

Es importante destacar que esta base de datos está en proceso de expansión, particularmente en lo que respecta a las etiquetas de montas activas, cuyo proceso de identificación y etiquetado es más complejo en comparación con otros tipos de movimiento. Su principal aplicación es el entrenamiento de algoritmos de clasificación automática para la detección de montas activas.
