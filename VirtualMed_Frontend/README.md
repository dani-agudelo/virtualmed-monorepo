# VirtualMed Frontend

Frontend de VirtualMed construido con Next.js para la gestion de autenticacion, dashboard y flujos clinicos (citas, encuentros clinicos, historial medico y registro de usuarios).

## Stack principal

- Next.js 14 (App Router)
- React 18 + TypeScript
- Tailwind CSS
- React Query (@tanstack/react-query)
- Zustand (estado global)
- React Hook Form + Zod (formularios y validacion)
- Vitest + Testing Library (pruebas)

## Requisitos

- Node.js 18+
- npm 9+

## Ejecutar en local

1. Instalar dependencias:

```bash
npm install
```

2. Levantar servidor de desarrollo:

```bash
npm run dev
```

3. Abrir en navegador:

http://localhost:3000

## Scripts disponibles

- `npm run dev`: inicia la app en modo desarrollo.
- `npm run build`: genera el build de produccion.
- `npm run start`: ejecuta el build generado.
- `npm run lint`: corre reglas de linting con Next.js.
- `npm run test`: ejecuta pruebas una sola vez.
- `npm run test:watch`: ejecuta pruebas en modo watch.
- `npm run test:coverage`: ejecuta pruebas con cobertura.

## Estructura relevante

- `src/app/`: rutas y paginas (login, registro, dashboard).
- `src/components/`: componentes de UI y formularios por dominio.
- `src/lib/`: utilidades y clientes API.
- `src/store/`: stores globales (auth/UI).
- `src/hooks/`: hooks reutilizables.
- `src/constants/`: enums y constantes del dominio.
- `src/test/`: configuracion de pruebas.

## Cobertura y reportes

El proyecto ya genera reporte de coverage con Vitest. Al ejecutar `npm run test:coverage`, se actualiza el directorio `coverage/`.

## Estado del proyecto

Actualmente no existe un deploy oficial configurado para este frontend.
