const API = "http://localhost:3000/api";

let grafica = null;
let graficaPrediccion = null;

document.addEventListener("DOMContentLoaded", () => {
    cargarDashboard();
    cargarEmpresas();
    cargarRanking();
});

async function cargarDashboard() {
    const res = await fetch(`${API}/dashboard`);
    const data = await res.json();

    const fechaMin = data.rango_fechas.fecha_inicio.substring(0, 10);
    const fechaMax = data.rango_fechas.fecha_fin.substring(0, 10);

    document.getElementById("fechaInicio").min = fechaMin;
    document.getElementById("fechaInicio").max = fechaMax;
    document.getElementById("fechaInicio").value = fechaMin;

    document.getElementById("fechaFin").min = fechaMin;
    document.getElementById("fechaFin").max = fechaMax;
    document.getElementById("fechaFin").value = fechaMax;

    document.getElementById("dashboard").innerHTML = `
        <div class="card">
            <h3>Empresas Analizadas</h3>
            <p>${data.total_empresas}</p>
        </div>
        <div class="card">
            <h3>Cotizaciones Históricas</h3>
            <p>${Number(data.total_cotizaciones).toLocaleString()}</p>
        </div>
        <div class="card">
            <h3>Mayor Precio Histórico</h3>
            <p>${data.empresa_mayor_precio.ticker}</p>
        </div>
        <div class="card">
            <h3>Mayor Volumen Operado</h3>
            <p>${data.empresa_mayor_volumen.ticker}</p>
        </div>
    `;
}

async function cargarEmpresas() {
    const res = await fetch(`${API}/empresas`);
    const empresas = await res.json();

    const selects = [
        document.getElementById("empresa"),
        document.getElementById("empresa1"),
        document.getElementById("empresa2"),
        document.getElementById("empresaPrediccion")
    ];

    selects.forEach(select => {
        if (!select) return;

        select.innerHTML = "";

        empresas.forEach(emp => {
            select.innerHTML += `
                <option value="${emp.id_empresa}">
                    ${emp.nombre} (${emp.ticker})
                </option>
            `;
        });
    });
}

async function analizarEmpresa() {
    const idEmpresa = document.getElementById("empresa").value;
    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;

    let url = `${API}/analisis/${idEmpresa}?`;

    if (fechaInicio) url += `fecha_inicio=${fechaInicio}&`;
    if (fechaFin) url += `fecha_fin=${fechaFin}&`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    mostrarRecomendacion(data);
    mostrarMetricas(data.metricas);
    dibujarGrafica(data.serie_precios);
}

function mostrarRecomendacion(data) {
    const m = data.metricas;

    let texto = "";
    let clase = "";

    if (m.sharpe_ratio > 0.55 && m.volatilidad_anualizada_porcentaje < 45) {
        texto = `🟢 Perfil atractivo: ${data.empresa.nombre} presenta buena relación rendimiento-riesgo.`;
        clase = "comprar";
    } else if (m.volatilidad_anualizada_porcentaje >= 45 || m.max_drawdown_porcentaje < -75) {
        texto = `🔴 Riesgo alto: ${data.empresa.nombre} presenta alta volatilidad o caídas históricas fuertes.`;
        clase = "riesgo";
    } else {
        texto = `🟡 Perfil moderado: ${data.empresa.nombre} puede mantenerse bajo observación.`;
        clase = "mantener";
    }

    document.getElementById("recomendacion").innerHTML = `
        <div class="alerta ${clase}">
            ${texto}
        </div>
    `;
}

function mostrarMetricas(m) {
    document.getElementById("metricas").innerHTML = `
        <div class="metrica">
            Rendimiento Acumulado
            <span>${m.rendimiento_acumulado_porcentaje.toFixed(2)}%</span>
        </div>
        <div class="metrica">
            Rendimiento Log Acumulado
            <span>${m.rendimiento_logaritmico_acumulado.toFixed(2)}</span>
        </div>
        <div class="metrica">
            Volatilidad Anualizada
            <span>${m.volatilidad_anualizada_porcentaje.toFixed(2)}%</span>
        </div>
        <div class="metrica">
            VaR 95%
            <span>${m.var_95_porcentaje.toFixed(2)}%</span>
        </div>
        <div class="metrica">
            Máximo Drawdown
            <span>${m.max_drawdown_porcentaje.toFixed(2)}%</span>
        </div>
        <div class="metrica">
            Sharpe Ratio
            <span>${m.sharpe_ratio.toFixed(2)}</span>
        </div>
        <div class="metrica">
            Sortino Ratio
            <span>${m.sortino_ratio.toFixed(2)}</span>
        </div>
        <div class="metrica">
            Mejor Día
            <span>${m.mejor_dia_porcentaje.toFixed(2)}%</span>
        </div>
        <div class="metrica">
            Peor Día
            <span>${m.peor_dia_porcentaje.toFixed(2)}%</span>
        </div>
    `;
}

function dibujarGrafica(datos) {
    const ctx = document.getElementById("graficaPrecios");

    const labels = datos.map(d => new Date(d.fecha).toLocaleDateString("es-MX"));
    const precios = datos.map(d => Number(d.cierre));

    if (grafica) {
        grafica.destroy();
    }

    grafica = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Precio de cierre",
                data: precios,
                borderWidth: 2,
                tension: 0.25
            }]
        },
        options: {
            responsive: true
        }
    });
}

async function generarPrediccion() {
    const idEmpresa = document.getElementById("empresaPrediccion").value;
    const dias = document.getElementById("diasPrediccion").value;

    const res = await fetch(`${API}/prediccion/${idEmpresa}?dias=${dias}`);
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    let claseTendencia = "mantener";
    let icono = "🟡";

    if (data.tendencia === "Alcista") {
        claseTendencia = "comprar";
        icono = "🟢";
    } else if (data.tendencia === "Bajista") {
        claseTendencia = "riesgo";
        icono = "🔴";
    }

    const ultimoPredicho = data.predicciones[data.predicciones.length - 1].precio_predicho;
    const diferencia = ((ultimoPredicho - data.ultimo_precio_real) / data.ultimo_precio_real) * 100;

    document.getElementById("resultadoPrediccion").innerHTML = `
        <div class="metrica">
            Empresa
            <span>${data.empresa.nombre} (${data.empresa.ticker})</span>
        </div>

        <div class="metrica">
            Último precio real
            <span>$${Number(data.ultimo_precio_real).toFixed(2)}</span>
        </div>

        <div class="metrica">
            Predicción a ${data.dias_predichos} días
            <span>$${Number(ultimoPredicho).toFixed(2)}</span>
        </div>

        <div class="metrica">
            Variación esperada
            <span>${diferencia.toFixed(2)}%</span>
        </div>

        <div class="metrica">
            Tendencia
            <span>${icono} ${data.tendencia}</span>
        </div>

        <div class="metrica">
            Método
            <span>Regresión lineal</span>
        </div>
    `;

    document.getElementById("resultadoPrediccion").insertAdjacentHTML("beforebegin", `
        <div class="alerta ${claseTendencia}" id="alertaPrediccion">
            ${icono} Predicción ${data.tendencia}: el modelo estima un precio de 
            $${Number(ultimoPredicho).toFixed(2)} en ${data.dias_predichos} días.
        </div>
    `);

    const alertaAnterior = document.querySelectorAll("#alertaPrediccion");
    if (alertaAnterior.length > 1) {
        alertaAnterior[0].remove();
    }

    dibujarGraficaPrediccion(data);
}

function dibujarGraficaPrediccion(data) {
    const ctx = document.getElementById("graficaPrediccion");

    const labels = ["Último real", ...data.predicciones.map(p => `Día ${p.dia}`)];
    const precios = [
        Number(data.ultimo_precio_real),
        ...data.predicciones.map(p => Number(p.precio_predicho))
    ];

    if (graficaPrediccion) {
        graficaPrediccion.destroy();
    }

    graficaPrediccion = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: `Predicción ${data.dias_predichos} días`,
                data: precios,
                borderWidth: 3,
                tension: 0.25
            }]
        },
        options: {
            responsive: true
        }
    });
}

async function cargarRanking() {
    const res = await fetch(`${API}/ranking-riesgo`);
    const ranking = await res.json();

    const tabla = document.getElementById("tablaRanking");
    tabla.innerHTML = "";

    ranking.forEach(emp => {
        let riesgo = "";
        let clase = "";

        if (emp.volatilidad_anualizada < 30) {
            riesgo = "BAJO";
            clase = "riesgo-bajo";
        } else if (emp.volatilidad_anualizada < 45) {
            riesgo = "MEDIO";
            clase = "riesgo-medio";
        } else {
            riesgo = "ALTO";
            clase = "riesgo-alto";
        }

        tabla.innerHTML += `
            <tr>
                <td>${emp.empresa}</td>
                <td>${emp.ticker}</td>
                <td>${emp.volatilidad_anualizada.toFixed(2)}%</td>
                <td>${emp.var_95.toFixed(2)}%</td>
                <td>${emp.max_drawdown.toFixed(2)}%</td>
                <td>${emp.sharpe_ratio.toFixed(2)}</td>
                <td>${emp.sortino_ratio.toFixed(2)}</td>
                <td class="${clase}">${riesgo}</td>
            </tr>
        `;
    });
}

async function compararEmpresas() {
    const id1 = document.getElementById("empresa1").value;
    const id2 = document.getElementById("empresa2").value;

    if (!id1 || !id2) {
        alert("Selecciona dos empresas");
        return;
    }

    if (id1 === id2) {
        alert("Selecciona dos empresas diferentes");
        return;
    }

    const res = await fetch(`${API}/comparar?id1=${id1}&id2=${id2}`);
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    const e1 = data.empresa_1;
    const e2 = data.empresa_2;

    document.getElementById("comparacion").innerHTML = `
        <div class="card">
            <h3>${e1.empresa.nombre} (${e1.empresa.ticker})</h3>
            <p>Rendimiento: ${e1.metricas.rendimiento_acumulado_porcentaje.toFixed(2)}%</p>
            <p>Volatilidad: ${e1.metricas.volatilidad_anualizada_porcentaje.toFixed(2)}%</p>
            <p>VaR 95%: ${e1.metricas.var_95_porcentaje.toFixed(2)}%</p>
            <p>Drawdown: ${e1.metricas.max_drawdown_porcentaje.toFixed(2)}%</p>
            <p>Sharpe: ${e1.metricas.sharpe_ratio.toFixed(2)}</p>
            <p>Sortino: ${e1.metricas.sortino_ratio.toFixed(2)}</p>
        </div>

        <div class="card">
            <h3>${e2.empresa.nombre} (${e2.empresa.ticker})</h3>
            <p>Rendimiento: ${e2.metricas.rendimiento_acumulado_porcentaje.toFixed(2)}%</p>
            <p>Volatilidad: ${e2.metricas.volatilidad_anualizada_porcentaje.toFixed(2)}%</p>
            <p>VaR 95%: ${e2.metricas.var_95_porcentaje.toFixed(2)}%</p>
            <p>Drawdown: ${e2.metricas.max_drawdown_porcentaje.toFixed(2)}%</p>
            <p>Sharpe: ${e2.metricas.sharpe_ratio.toFixed(2)}</p>
            <p>Sortino: ${e2.metricas.sortino_ratio.toFixed(2)}</p>
        </div>

        <div class="card">
            <h3>Conclusión Automática</h3>
            <p>Mayor rendimiento: ${data.conclusion.mayor_rendimiento}</p>
            <p>Mayor volatilidad: ${data.conclusion.mayor_volatilidad}</p>
            <p>Mejor Sharpe: ${data.conclusion.mejor_sharpe}</p>
            <p>
                Interpretación: ${data.conclusion.mejor_sharpe} muestra la mejor relación rendimiento-riesgo,
                mientras que ${data.conclusion.mayor_volatilidad} presenta mayor incertidumbre histórica.
            </p>
        </div>
    `;
}