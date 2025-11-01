/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"SF Pro Text"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
      colors: {
        coach: {
          page: "#F5F7FB",
          surface: "#FFFFFF",
          surfaceSoft: "#F3F5FB",
          surfaceMuted: "#F8F9FC",
          border: "#E4E7EC",
          borderStrong: "#D0D5DD",
          heading: "#101828",
          body: "#475467",
          subtle: "#667085",
          muted: "#98A2B3",
          accent: "#1570EF",
          success: "#027A48",
          successSoft: "#ECFDF3",
          warning: "#B54708",
          highlight: "#F2F4F7",
          highlightBorder: "#EAECF0",
          pill: "#EEF2FF",
          calendarAccent: "#EEF4FF",
          divider: "#F1F5F9",
          cta: "#16A34A",
          ctaHover: "#15803D",
          focus: "#BBD4FF",
        },
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '28px',
      },
      boxShadow: {
        'coach-card': '0 30px 50px -30px rgba(15, 23, 42, 0.35), 0 25px 40px -32px rgba(15, 23, 42, 0.16)',
        'coach-soft': '0 18px 40px -28px rgba(15, 23, 42, 0.25)',
        'coach-inner': 'inset 0 0 0 1px rgba(226, 232, 240, 0.9)',
      },
    },
  },
  plugins: [],
};
