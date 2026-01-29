/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#FF8C00', // Orange DO NOT CHANGE
                secondary: '#FB923C', // Orange 400

                // Dark Theme Palette
                background: '#0F1115', // Deep Black
                surface: '#181B21',     // Dark Surface (Cards)
                surfaceHighlight: '#22262E', // Lighter Surface (Hover)

                text: {
                    primary: '#FFFFFF',   // White
                    secondary: '#9CA3AF', // Gray 400
                    muted: '#6B7280'      // Gray 500
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            borderRadius: {
                '3xl': '1.5rem', // For the smoother card look
            }
        },
    },
    plugins: [],
}
