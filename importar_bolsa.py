import yfinance as yf
import mysql.connector

# EMPRESAS
empresas = {
    'AAPL': ('Apple', 'Tecnología'),
    'MSFT': ('Microsoft', 'Tecnología'),
    'AMZN': ('Amazon', 'Comercio Electrónico'),
    'GOOGL': ('Alphabet', 'Tecnología'),
    'META': ('Meta Platforms', 'Redes Sociales'),
    'TSLA': ('Tesla', 'Automotriz'),
    'NFLX': ('Netflix', 'Streaming'),
    'NVDA': ('Nvidia', 'Semiconductores'),
    'ADBE': ('Adobe', 'Software'),
    'CRM': ('Salesforce', 'Software')
}

# CONEXIÓN MYSQL
conexion = mysql.connector.connect(
    host='localhost',
    user='root',
    password='LRFive5',
    database='proyecto_bolsa'
)

cursor = conexion.cursor()

# RECORRER EMPRESAS
for ticker, datos_empresa in empresas.items():

    nombre = datos_empresa[0]
    sector = datos_empresa[1]

    # INSERTAR EMPRESA
    cursor.execute("""
        INSERT INTO empresas(nombre, ticker, sector, pais)
        VALUES(%s, %s, %s, %s)
    """, (
        nombre,
        ticker,
        sector,
        'Estados Unidos'
    ))

    id_empresa = cursor.lastrowid

    print(f'Descargando {ticker}...')

    # DESCARGAR DATOS
    datos = yf.download(
        ticker,
        start='2007-01-01',
        interval='1d',
        auto_adjust=False
    )

    # RECORRER COTIZACIONES
    for fecha, fila in datos.iterrows():

        apertura = float(fila['Open'].iloc[0])
        maximo = float(fila['High'].iloc[0])
        minimo = float(fila['Low'].iloc[0])
        cierre = float(fila['Close'].iloc[0])

        # CIERRE AJUSTADO
        if 'Adj Close' in datos.columns:
            cierre_ajustado = float(fila['Adj Close'].iloc[0])
        else:
            cierre_ajustado = cierre

        volumen = int(fila['Volume'].iloc[0])

        # INSERTAR COTIZACIÓN
        cursor.execute("""
            INSERT INTO cotizaciones
            (
                id_empresa,
                fecha,
                apertura,
                maximo,
                minimo,
                cierre,
                cierre_ajustado,
                volumen
            )
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            id_empresa,
            fecha.date(),
            apertura,
            maximo,
            minimo,
            cierre,
            cierre_ajustado,
            volumen
        ))

    conexion.commit()

    print(f'{ticker} completado')

# CERRAR CONEXIÓN
cursor.close()
conexion.close()

print('BASE DE DATOS LLENA')