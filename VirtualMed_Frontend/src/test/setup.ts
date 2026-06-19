import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock de next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) =>
    React.createElement('a', { href }, children),
}));
