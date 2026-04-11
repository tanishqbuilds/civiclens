/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#1337ec',
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#1337ec',
                    700: '#1029c7',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
                severity: {
                    low: '#22c55e',
                    medium: '#f59e0b',
                    high: '#ef4444',
                    critical: '#dc2626',
                },
            },
            fontFamily: {
                display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '0.5rem',
                lg: '1rem',
                xl: '1.5rem',
                full: '9999px',
            },
        },
    },
    plugins: [],
};
