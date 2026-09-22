/**
 * Tailwind 配置（预编译用）
 *
 * 与原先 index.html 里那份 tailwind.config 完全一致，只是搬到了文件里。
 * content 只扫「会产生类名的文件」：两个页面 + 逻辑层。
 * 周刊的两个数据文件是纯 JSON 数据、体积大且不含类名，故意排除，否则构建会很慢。
 */
module.exports = {
  content: [
    './index.html',
    './weekly.html',
    './assets/js/app.js',
    './assets/js/weekly.js',
    './assets/js/data.js'
  ],
  theme: {
    extend: {
      // 语义色：全部由 CSS 变量驱动，切换 html.dark 即可整体换肤
      colors: {
        base:   'rgb(var(--c-base) / <alpha-value>)',
        panel:  'rgb(var(--c-panel) / <alpha-value>)',
        raise:  'rgb(var(--c-raise) / <alpha-value>)',
        hair:   'rgb(var(--c-hair) / <alpha-value>)',
        ink:    'rgb(var(--c-ink) / <alpha-value>)',
        dim:    'rgb(var(--c-dim) / <alpha-value>)',
        faint:  'rgb(var(--c-faint) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"',
               '"Microsoft YaHei"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
};
