const express = require('express');
const router = express.Router();

const empresasController = require('../controllers/empresasController');

// Empresas
router.get('/empresas', empresasController.obtenerEmpresas);

// Cotizaciones
router.get('/cotizaciones', empresasController.buscarCotizaciones);

// Resumen empresa
router.get('/resumen/:id_empresa', empresasController.resumenEmpresa);

// Análisis financiero
router.get('/analisis/:id_empresa', empresasController.analisisFinanciero);

// Dashboard general
router.get('/dashboard', empresasController.dashboardGeneral);

// Ranking de riesgo
router.get('/ranking-riesgo', empresasController.rankingRiesgo);

// Comparador
router.get('/comparar', empresasController.compararEmpresas);

// Predicción
router.get('/prediccion/:id_empresa', empresasController.prediccionEmpresa);

module.exports = router;