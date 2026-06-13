const db = require('../db');

const obtenerEmpresas = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM empresas ORDER BY nombre');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener empresas' });
    }
};

const buscarCotizaciones = async (req, res) => {
    try {
        const { id_empresa, fecha_inicio, fecha_fin, movimiento } = req.query;

        let sql = `
            SELECT 
                c.*, e.nombre AS empresa, e.ticker,
                ROUND(((c.cierre - c.apertura) / c.apertura) * 100, 4) AS rendimiento_diario,
                CASE
                    WHEN c.cierre > c.apertura THEN 'Subió'
                    WHEN c.cierre < c.apertura THEN 'Bajó'
                    ELSE 'Igual'
                END AS movimiento
            FROM cotizaciones c
            JOIN empresas e ON c.id_empresa = e.id_empresa
            WHERE 1=1
        `;

        const params = [];

        if (id_empresa) {
            sql += ' AND c.id_empresa = ?';
            params.push(id_empresa);
        }

        if (fecha_inicio) {
            sql += ' AND c.fecha >= ?';
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            sql += ' AND c.fecha <= ?';
            params.push(fecha_fin);
        }

        if (movimiento === 'subio') sql += ' AND c.cierre > c.apertura';
        if (movimiento === 'bajo') sql += ' AND c.cierre < c.apertura';
        if (movimiento === 'igual') sql += ' AND c.cierre = c.apertura';

        sql += ' ORDER BY c.fecha DESC LIMIT 1000';

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar cotizaciones' });
    }
};

const resumenEmpresa = async (req, res) => {
    try {
        const { id_empresa } = req.params;

        const [rows] = await db.query(`
            SELECT 
                e.nombre,
                e.ticker,
                COUNT(c.id_cotizacion) AS total_cotizaciones,
                MIN(c.fecha) AS fecha_inicio,
                MAX(c.fecha) AS fecha_final,
                MIN(c.minimo) AS precio_minimo,
                MAX(c.maximo) AS precio_maximo,
                AVG(c.cierre) AS promedio_cierre
            FROM empresas e
            JOIN cotizaciones c ON e.id_empresa = c.id_empresa
            WHERE e.id_empresa = ?
            GROUP BY e.id_empresa
        `, [id_empresa]);

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
};

const calcularMetricas = (datos) => {
    let rendimientos = [];

    for (let i = 1; i < datos.length; i++) {
        const cierreAnterior = Number(datos[i - 1].cierre);
        const cierreActual = Number(datos[i].cierre);

        const rendimiento = (cierreActual - cierreAnterior) / cierreAnterior;
        const rendimientoLog = Math.log(cierreActual / cierreAnterior);

        rendimientos.push({
            fecha: datos[i].fecha,
            rendimiento,
            rendimientoLog
        });
    }

    const suma = rendimientos.reduce((acc, r) => acc + r.rendimiento, 0);
    const promedio = suma / rendimientos.length;

    const varianza = rendimientos.reduce((acc, r) => {
        return acc + Math.pow(r.rendimiento - promedio, 2);
    }, 0) / rendimientos.length;

    const volatilidadDiaria = Math.sqrt(varianza);
    const volatilidadAnualizada = volatilidadDiaria * Math.sqrt(252);

    const rendimientoLogAcumulado = rendimientos.reduce((acc, r) => acc + r.rendimientoLog, 0);
    const rendimientoAcumulado = Math.exp(rendimientoLogAcumulado) - 1;

    const ordenados = [...rendimientos].sort((a, b) => a.rendimiento - b.rendimiento);
    const indiceVar95 = Math.floor(ordenados.length * 0.05);
    const var95 = ordenados[indiceVar95]?.rendimiento || 0;

    const peorDia = ordenados[0]?.rendimiento || 0;
    const mejorDia = ordenados[ordenados.length - 1]?.rendimiento || 0;

    let maxPrecio = Number(datos[0].cierre);
    let maxDrawdown = 0;

    datos.forEach(d => {
        const cierre = Number(d.cierre);
        if (cierre > maxPrecio) maxPrecio = cierre;
        const drawdown = (cierre - maxPrecio) / maxPrecio;
        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    });

    const tasaLibreRiesgoDiaria = 0.11 / 252;
    const exceso = promedio - tasaLibreRiesgoDiaria;
    const sharpe = volatilidadDiaria !== 0 ? (exceso / volatilidadDiaria) * Math.sqrt(252) : 0;

    const negativos = rendimientos.filter(r => r.rendimiento < 0);

    const downsideVariance = negativos.reduce((acc, r) => {
        return acc + Math.pow(r.rendimiento, 2);
    }, 0) / negativos.length;

    const downsideDeviation = Math.sqrt(downsideVariance);
    const sortino = downsideDeviation !== 0 ? (exceso / downsideDeviation) * Math.sqrt(252) : 0;

    return {
        total_dias_analizados: rendimientos.length,
        rendimiento_acumulado_porcentaje: rendimientoAcumulado * 100,
        rendimiento_logaritmico_acumulado: rendimientoLogAcumulado,
        rendimiento_promedio_diario_porcentaje: promedio * 100,
        volatilidad_diaria_porcentaje: volatilidadDiaria * 100,
        volatilidad_anualizada_porcentaje: volatilidadAnualizada * 100,
        var_95_porcentaje: var95 * 100,
        peor_dia_porcentaje: peorDia * 100,
        mejor_dia_porcentaje: mejorDia * 100,
        max_drawdown_porcentaje: maxDrawdown * 100,
        sharpe_ratio: sharpe,
        sortino_ratio: sortino
    };
};

const analisisFinanciero = async (req, res) => {
    try {
        const { id_empresa } = req.params;
        const { fecha_inicio, fecha_fin } = req.query;

        let sql = `
            SELECT fecha, apertura, cierre, maximo, minimo, volumen
            FROM cotizaciones
            WHERE id_empresa = ?
        `;

        const params = [id_empresa];

        if (fecha_inicio) {
            sql += ' AND fecha >= ?';
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            sql += ' AND fecha <= ?';
            params.push(fecha_fin);
        }

        sql += ' ORDER BY fecha ASC';

        const [datos] = await db.query(sql, params);

        if (datos.length < 2) {
            return res.status(400).json({ error: 'No hay suficientes datos para analizar' });
        }

        const [empresa] = await db.query(
            'SELECT nombre, ticker FROM empresas WHERE id_empresa = ?',
            [id_empresa]
        );

        const metricas = calcularMetricas(datos);

        res.json({
            empresa: empresa[0],
            periodo: {
                fecha_inicio: datos[0].fecha,
                fecha_fin: datos[datos.length - 1].fecha
            },
            metricas,
            serie_precios: datos.slice(-250)
        });

    } catch (error) {
        res.status(500).json({ error: 'Error en análisis financiero' });
    }
};

const dashboardGeneral = async (req, res) => {
    try {
        const [totalEmpresas] = await db.query('SELECT COUNT(*) AS total FROM empresas');
        const [totalCotizaciones] = await db.query('SELECT COUNT(*) AS total FROM cotizaciones');

        const [rangoFechas] = await db.query(`
            SELECT MIN(fecha) AS fecha_inicio, MAX(fecha) AS fecha_fin
            FROM cotizaciones
        `);

        const [mayorPrecio] = await db.query(`
            SELECT e.nombre, e.ticker, MAX(c.maximo) AS precio_maximo
            FROM empresas e
            JOIN cotizaciones c ON e.id_empresa = c.id_empresa
            GROUP BY e.id_empresa
            ORDER BY precio_maximo DESC
            LIMIT 1
        `);

        const [mayorVolumen] = await db.query(`
            SELECT e.nombre, e.ticker, SUM(c.volumen) AS volumen_total
            FROM empresas e
            JOIN cotizaciones c ON e.id_empresa = c.id_empresa
            GROUP BY e.id_empresa
            ORDER BY volumen_total DESC
            LIMIT 1
        `);

        res.json({
            total_empresas: totalEmpresas[0].total,
            total_cotizaciones: totalCotizaciones[0].total,
            rango_fechas: rangoFechas[0],
            empresa_mayor_precio: mayorPrecio[0],
            empresa_mayor_volumen: mayorVolumen[0]
        });

    } catch (error) {
        res.status(500).json({ error: 'Error al obtener dashboard' });
    }
};

const rankingRiesgo = async (req, res) => {
    try {
        const [empresas] = await db.query('SELECT id_empresa, nombre, ticker FROM empresas');
        const ranking = [];

        for (const empresa of empresas) {
            const [datos] = await db.query(`
                SELECT fecha, cierre
                FROM cotizaciones
                WHERE id_empresa = ?
                ORDER BY fecha ASC
            `, [empresa.id_empresa]);

            if (datos.length > 2) {
                const metricas = calcularMetricas(datos);

                ranking.push({
                    empresa: empresa.nombre,
                    ticker: empresa.ticker,
                    volatilidad_anualizada: metricas.volatilidad_anualizada_porcentaje,
                    var_95: metricas.var_95_porcentaje,
                    max_drawdown: metricas.max_drawdown_porcentaje,
                    sharpe_ratio: metricas.sharpe_ratio,
                    sortino_ratio: metricas.sortino_ratio,
                    rendimiento_acumulado: metricas.rendimiento_acumulado_porcentaje
                });
            }
        }

        ranking.sort((a, b) => b.volatilidad_anualizada - a.volatilidad_anualizada);

        res.json(ranking);

    } catch (error) {
        res.status(500).json({ error: 'Error al calcular ranking de riesgo' });
    }
};

const compararEmpresas = async (req, res) => {
    try {
        const { id1, id2 } = req.query;

        if (!id1 || !id2) {
            return res.status(400).json({ error: 'Debes enviar id1 e id2' });
        }

        const analizar = async (id) => {
            const [empresa] = await db.query(
                'SELECT nombre, ticker FROM empresas WHERE id_empresa = ?',
                [id]
            );

            const [datos] = await db.query(`
                SELECT fecha, cierre
                FROM cotizaciones
                WHERE id_empresa = ?
                ORDER BY fecha ASC
            `, [id]);

            return {
                empresa: empresa[0],
                metricas: calcularMetricas(datos)
            };
        };

        const empresa1 = await analizar(id1);
        const empresa2 = await analizar(id2);

        res.json({
            empresa_1: empresa1,
            empresa_2: empresa2,
            conclusion: {
                mayor_rendimiento:
                    empresa1.metricas.rendimiento_acumulado_porcentaje >
                    empresa2.metricas.rendimiento_acumulado_porcentaje
                        ? empresa1.empresa.nombre
                        : empresa2.empresa.nombre,

                mayor_volatilidad:
                    empresa1.metricas.volatilidad_anualizada_porcentaje >
                    empresa2.metricas.volatilidad_anualizada_porcentaje
                        ? empresa1.empresa.nombre
                        : empresa2.empresa.nombre,

                mejor_sharpe:
                    empresa1.metricas.sharpe_ratio >
                    empresa2.metricas.sharpe_ratio
                        ? empresa1.empresa.nombre
                        : empresa2.empresa.nombre
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Error al comparar empresas' });
    }
};

const prediccionEmpresa = async (req, res) => {
    try {
        const { id_empresa } = req.params;
        let dias = Number(req.query.dias) || 7;

        if (![7, 15, 30].includes(dias)) {
            dias = 7;
        }

        const [empresa] = await db.query(
            'SELECT nombre, ticker FROM empresas WHERE id_empresa = ?',
            [id_empresa]
        );

        const [datos] = await db.query(`
            SELECT fecha, cierre
            FROM cotizaciones
            WHERE id_empresa = ?
            ORDER BY fecha DESC
            LIMIT 120
        `, [id_empresa]);

        if (datos.length < 30) {
            return res.status(400).json({
                error: 'No hay suficientes datos para generar predicción'
            });
        }

        const ordenados = datos.reverse();
        const n = ordenados.length;

        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;

        ordenados.forEach((d, i) => {
            const x = i + 1;
            const y = Number(d.cierre);

            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });

        const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercepto = (sumY - pendiente * sumX) / n;

        const ultimoPrecio = Number(ordenados[ordenados.length - 1].cierre);
        const predicciones = [];

        for (let i = 1; i <= dias; i++) {
            const precioPredicho = intercepto + pendiente * (n + i);

            predicciones.push({
                dia: i,
                precio_predicho: Number(precioPredicho.toFixed(4))
            });
        }

        res.json({
            empresa: empresa[0],
            metodo: 'Regresión lineal sobre los últimos 120 días bursátiles',
            ultimo_precio_real: ultimoPrecio,
            dias_predichos: dias,
            tendencia:
                pendiente > 0 ? 'Alcista' :
                pendiente < 0 ? 'Bajista' :
                'Estable',
            pendiente,
            predicciones
        });

    } catch (error) {
        res.status(500).json({
            error: 'Error al generar predicción'
        });
    }
};

module.exports = {
    obtenerEmpresas,
    buscarCotizaciones,
    resumenEmpresa,
    analisisFinanciero,
    dashboardGeneral,
    rankingRiesgo,
    compararEmpresas,
    prediccionEmpresa
};