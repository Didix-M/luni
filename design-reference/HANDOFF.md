# Luni · resumen de preparación para desarrollo

## 1. Cómo está implementado hoy

- **Formato**: "Design Components" (`*.dc.html`). Cada archivo contiene una plantilla HTML con huecos `{{ ruta }}`, bucles `<sc-for>` y condicionales `<sc-if>`, y una clase `Component extends DCLogic` con `state` y `renderVals()`.
- **Runtime**: `support.js` (lo provee el entorno de diseño; incluye React). No hay bundler, TypeScript ni gestor de paquetes.
- **Estilos**: solo estilos en línea (`style`, `style-hover`, `style-focus`). No hay hojas de estilo ni tokens en archivo; los valores se repiten en cada pantalla.
- **Dependencias externas por CDN**: Google Fonts (Quicksand, Nunito) y `lucide-static@0.460.0` (iconos Lucide como fuente de iconos).
- **Persistencia**: estado de componente en memoria. `localStorage` solo para `luni.demo.perfilConfirmado` y `luni.demo.sesion`.
- **Navegación entre módulos**: enlaces entre archivos y `#hash` (p. ej. `Luni Postulaciones.dc.html#verde`). No hay router.
- **Migración**: para producción habrá que portar a un framework real (por ejemplo React/Next.js). No se ha hecho ni elegido nada; la plantilla y la lógica se traducen casi 1:1 a componentes.

## 2. Pantallas y rutas (propuesta de ruta → archivo actual)

| Ruta propuesta | Pantalla | Archivo / estado |
|---|---|---|
| `/acceso` | Iniciar sesión, recuperar contraseña, sesión expirada, sesión cerrada | `Luni Acceso.dc.html` (#recuperar, #expirada, #salida) |
| `/` | Inicio (dashboard) | `Luni.dc.html` (ronda 2: 2a desktop, 2c móvil) |
| `/vacantes` | Tabla/tarjetas con filtros | `Luni Seguimiento.dc.html#vacantes` |
| `/vacantes/:id` | Detalle de vacante y elegibilidad | `Luni.dc.html` (2b) |
| `/vacantes/nueva` | Añadir y analizar vacante | `Luni Preparar solicitud.dc.html` (paso 1-3) |
| `/solicitudes/:id/cv` `/respuestas` `/revision` `/envio` `/confirmacion` | Preparar y autorizar | `Luni Preparar solicitud.dc.html` |
| `/postulaciones` `/postulaciones/:id` | Lista, detalle, entrevistas, recordatorios, registro manual, agenda | `Luni Postulaciones.dc.html` |
| `/notificaciones` | Centro de notificaciones | `Luni Postulaciones.dc.html#notificaciones` |
| `/perfil` | Configurar perfil (subir CV, revisar, preferencias, resumen) | `Luni Configurar perfil.dc.html` |
| `/cv` | Mis CV y adaptaciones | `Luni Configurar perfil.dc.html` (paso Mis CV) |
| `/perfil/respuestas` | Biblioteca de respuestas, editor, adaptación en solicitud | `Luni Respuestas y Configuración.dc.html` |
| `/configuracion` | Preferencias, notificaciones, cuenta, datos, conexiones | `Luni Respuestas y Configuración.dc.html#config` |

Nota: `Luni Seguimiento.dc.html` contiene una versión previa de Postulaciones, Notificaciones y Respuestas que quedó reemplazada por los módulos nuevos; solo su pestaña **Vacantes** sigue en uso.

## 3. Reglas de producto reflejadas en el prototipo

- Aprobar una vacante solo permite preparar la solicitud; el envío exige autorización final explícita, válida para esa solicitud y esa versión de los datos.
- Nada se marca "Enviada" sin confirmación de la plataforma o confirmación manual de la usuaria (con su fuente). Un resultado incierto no cuenta como enviado ni se reintenta solo.
- Tres estados independientes: estado de la postulación, resultado del envío, estado de la vacante (Abierta / Cerrada / No se pudo verificar). Una vacante cerrada no rechaza la candidatura.
- Elegibilidad desde Panamá separada de la compatibilidad ("Remoto" no implica Panamá).
- Datos desconocidos quedan vacíos y marcados como pendientes ("No publicado", "Por confirmar"). Sin conversiones silenciosas de moneda.
- Preguntas sensibles, legales, credenciales y consentimientos no se responden ni se guardan en la biblioteca.
- La experiencia en diseño no suma marketing ni cuenta dos veces periodos superpuestos.

## 4. Tokens de diseño

**Color**: azul marino `#101B35` (navegación, texto de acción) · verde `#C5FF45` (acción principal, con texto `#101B35`; no usar como texto sobre blanco) · fondo `#F5F6F8` · blanco `#FFFFFF` · negro `#111111` · bordes `#DDE1E8` / `#B9BFCB` · texto secundario `#4A5163` / `#5B6272`.
**Semánticos** (fondo / texto): éxito `#E7F5EC` / `#17663F` · advertencia `#FFF4D9` / `#7A4E00` · error `#FDECEA` / `#A4271B` · información `#E9F0FD` / `#1E55B8`.
**Tipografía**: títulos Quicksand 600-700; interfaz Nunito 400-700; números tabulares en métricas y porcentajes. Texto base 16 px, secundario ≥ 14 px.
**Espaciado y forma**: radios 10-12 px (controles), 14-16 px (tarjetas); objetivos táctiles ≥ 44 px; grillas de 4/8 px; contenido máximo 1040-1160 px.
**Foco**: contorno de 2 px `#101B35` con separación de 1-2 px (en fondos oscuros, `#C5FF45` o blanco).
**Estados** (siempre con icono y texto, no solo color): Extraído / Confirmado / Pendiente; Completo / Necesita revisión / Falta información; Cumple / Parcial / Falta / Sin confirmar; Disponible / Pendiente de configurar / Requiere atención / No compatible.

## 5. Componentes reutilizables (patrones repetidos)

Wordmark (dos círculos) · Sidebar desktop · Barra inferior móvil con zona segura · Barra superior móvil · Chip de estado · Insignia de origen del dato · Insignia "Datos de demostración" · Stepper · Barra de acciones fija inferior · Barra de filtros / chips de selección · Campo genérico (input, select, textarea) · Tarjeta de alerta y de pregunta sensible · Línea de tiempo (con origen: integración / registrado por ti / Luni) · Estado vacío, de carga y de error · Toast · Panel "Simulación del prototipo" · Diálogo de confirmación destructiva · Tabla (desktop) con tarjetas (móvil).

## 6. Qué funciona en el prototipo y qué necesita backend

| Función | En el prototipo | Para producción |
|---|---|---|
| Acceso, recuperación, expiración | Simulado; correo de demostración con contraseña ≥ 8 caracteres | Autenticación real, cuenta única autorizada, sesiones, correo de recuperación |
| Subir y leer CV | Selección de archivo; lectura simulada con datos ficticios | Almacenamiento seguro, extracción de texto/estructura (PDF/DOCX), revisión humana |
| Analizar vacante por enlace | Simulado (vacante ficticia) | Lectura de páginas, manejo de login/CAPTCHA/bloqueos, detección de cierre |
| Compatibilidad y adaptaciones con IA | Reglas fijas y textos de ejemplo | Proveedor de IA restringido a datos confirmados, límites y auditoría |
| Completar y enviar formularios | Simulación de estados | Integraciones por plataforma o apertura asistida; confirmación verificable |
| Notificaciones (app / correo / push) | Solo dentro de la app, simulado | Correo transaccional, Web Push, horarios y permisos reales |
| Calendario | Mensaje de archivo .ics simulado | Generación de .ics e integraciones opcionales |
| Exportar y eliminar datos | Simulado | Exportación real y borrado verificable con reglas de retención |
| Copia histórica de lo enviado | Mostrada en pantalla | Instantáneas inmutables por postulación |

## 7. Comprobaciones

Realizadas: revisión automática de errores de consola y de la carga de cada módulo al entregarlo; verificación visual puntual de desktop y móvil por el revisor automático; revisión manual de código de enlaces y botones, y coherencia de contadores.
Pendientes: prueba en 768 px; recorrido completo solo con teclado; auditoría de contraste con herramienta; prueba con lector de pantalla; prueba en dispositivos reales (teclado móvil, safe areas); pruebas con textos muy largos en todas las pantallas; pruebas de rendimiento.

## 8. Base de datos sugerida (no implementada)

`profiles`, `experiences`, `education`, `skills`, `languages`, `preferences`, `cv_versions`, `answers` (+ evidencia), `jobs` (+ requisitos, verificaciones), `applications` (+ instantánea de CV y respuestas, autorización, resultado de envío), `application_events`, `interviews`, `reminders`, `notifications`, `notification_settings`.
