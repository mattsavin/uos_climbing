import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/backend/**/*.test.ts'],
        setupFiles: ['tests/backend/setup.ts'],
        globals: true,
        fileParallelism: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['backend/**/*.ts'],
            exclude: ['backend/db.ts', 'backend/server.ts']
        }
    },
});
