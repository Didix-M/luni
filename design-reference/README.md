# Luni · prototipo interactivo

Prototipo de alta fidelidad de una aplicación web privada (una sola usuaria) para gestionar y preparar postulaciones laborales. Toda la interfaz está en español. Todos los datos son ficticios (perfil de demostración: Alma Ruiz).

## Cómo abrirlo

1. Descarga o clona la carpeta completa (deben estar juntos todos los `.dc.html` y `support.js`).
2. Sírvela con cualquier servidor estático, por ejemplo: `python3 -m http.server 8080`.
3. Abre `http://localhost:8080/Luni%20Acceso.dc.html`.

Requiere conexión a internet para las fuentes (Google Fonts) y los iconos (Lucide, vía CDN).
No hay `npm install`, build ni backend.

## Qué es y qué no es

- Es un prototipo navegable en HTML. Los estados viven en memoria del navegador y se pierden al recargar.
- Solo dos valores se guardan en `localStorage`: `luni.demo.perfilConfirmado` y `luni.demo.sesion`, para simular primera visita y sesión. No es una conexión con Supabase ni con ningún servicio.
- No se contacta ninguna plataforma de empleo, correo, calendario ni proveedor de IA. Cada simulación está identificada en pantalla.

## Archivos

Ver `HANDOFF.md` para pantallas, rutas, componentes, tokens y límites del prototipo.
Las variables de `.env.example` son para la futura implementación; el prototipo no las lee.
