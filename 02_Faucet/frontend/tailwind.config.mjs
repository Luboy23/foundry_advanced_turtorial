/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      backgroundImage: {
        'faucet': "url('/assets/faucet.gif')",
      },
      fontFamily: {
        wq: ['wq'], // 供 className="font-wq" 使用的自定义字体族
      },
      animation: {
        'marquee': 'marquee 10s linear infinite', // 用于“连接钱包…”提示的跑马灯动画
      },
      keyframes: {
        marquee: {
          '0%': {
            transform: 'translateX(100%)',
          },
          '100%': {
            transform: 'translateX(-100%)',
          },
        },
      },
    },
  },
  plugins: [],
};
