# Frontend Tests Documentation

## Overview

Este proyecto incluye tests unitarios para los formularios y funciones útiles utilizando **Vitest** y **React Testing Library**.

## Estructura de Tests

```
src/
├── components/
│   ├── __tests__/
│   │   └── # Tests
├── test/
│   ├── setup.ts  # Configuración global de tests
│   └── ...
```

## Requisitos

- Node.js 22+
- npm 9+

## Instalación

Las dependencias de testing ya están instaladas. Si necesitas instalarlas manualmente:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event @testing-library/dom @vitest/ui @vitest/coverage-v8 happy-dom @vitejs/plugin-react vite
```

## Ejecutar Tests

### Modo ejecución única
```bash
npm run test
```

### Con coverage
```bash
npm run test:coverage
```
Incluye un reporte HTML disponible en `coverage/index.html`

### Correr un archivo de test específico:
```bash
npm run test archivo_especifico:
```

### Verificar si existen errores de tipado
```bash
npm run lint
```

### Verificar si existen problemas de compilación
```bash
npm run build
```

## Configuración

### vitest.config.ts
- **Environment**: happy-dom (más ligero que jsdom)
- **Globals**: true (no necesitas importar describe, it, expect, etc.)
- **Coverage threshold**: 60% mínimo para todas las métricas

### src/test/setup.ts
- Importa jest-dom matchers
- Mockea módulos de Next.js (next/navigation, next/link)
- Limpia DOM después de cada test

## Cobertura

Cobertura mínima requerida: **60%**

## Escribir Nuevos Tests

### Estructura básica
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Componente', () => {
  const mockFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe hacer algo', async () => {
    const user = userEvent.setup();
    render(<Componente />);
    
    // Interact with component
    await user.type(screen.getByRole('textbox'), 'text');
    
    // Assert
    expect(screen.getByText('expected')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Los tests no se ejecutan
```bash
# Limpiar cache
npm run test -- --clearCache

# Reinstalar dependencias
npm install
```

### Coverage no alcanza el 60%
- Agrega más tests para branches no cubiertas
- Revisa `coverage/index.html` para ver qué líneas falta cubrir
- Añade tests para casos edge

### Errores de MockedFunction
- Asegúrate de que los mocks están en `beforeEach(() => { vi.clearAllMocks() })`
- Verifica que los módulos mockeados estén en la raíz del archivo de tests

## Recursos

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
