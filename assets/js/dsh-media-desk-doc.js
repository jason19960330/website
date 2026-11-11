/**
 * ============================================================================
 *  dsh-media-desk-doc.js —— 自媒体工作台（dsh-media-desk）使用指南页 逻辑层
 * ============================================================================
 *  纯文档页，只做两件事：
 *    1. 深浅主题（与全站共用 localStorage 键 site.theme）
 *    2. 命令块的「复制」按钮（优先 Clipboard API，降级用 textarea + execCommand）
 * ============================================================================
 */
(function () {
  'use strict';

  var VueNS = window.Vue;

  if (!VueNS) { console.error('[dsh-media-desk-doc] 未找到 Vue，请确认 vendor/arco-bundle.js 已加载。'); return; }

  var THEME_KEY = 'site.theme';

  /* ---------------- 可复制的命令 / 配置文本 ---------------- */
  var TEXTS = {
    install:
      '# 前置：Node.js >= 20，DeepSeek Harness 0.2.1-rc.5 及以上的 0.2.x\n' +
      '# ① 安装（最简单：桌面版「插件 → 添加插件」直接填 dsh-media-desk）\n' +
      'dsh plugin --profile desktop add dsh-media-desk\n' +
      '# 网页版把 desktop 换成 web；桌面版装前要先完全退出（Cmd+Q），装好重开\n' +
      'dsh plugin --profile web add dsh-media-desk\n' +
      '\n' +
      '# ② 更新：插件页点更新，或重新执行一次上面那条 add 命令\n' +
      '# 离线安装：从 Releases 下载 tgz，把包名换成本地路径\n' +
      'dsh plugin --profile desktop add "file:$PWD/dsh-media-desk-2.6.2.tgz"\n' +
      '\n' +
      '# ③ 打开：侧栏出现「自媒体工作台」\n' +
      '# 首次是示例数据，点右上角「示例数据 · 清空」换成自己的\n' +
      '# 卸载（内容留在 ~/.dsh/media-desk/，不会跟着删）\n' +
      'dsh plugin --profile desktop remove dsh-media-desk',
    settings:
      '# 设置写在 ~/.dsh/media-desk/settings.json，文件权限 600\n' +
      '# 密钥不进内容数据、不返回浏览器、不发给文字模型\n' +
      '{\n' +
      '  "image": {\n' +
      '    "source": "http",\n' +
      '    "baseUrl": "https://api.openai.com/v1",\n' +
      '    "model": "gpt-image-1",\n' +
      '    "apiKey": "sk-...",\n' +
      '    "size": "1536x1024",\n' +
      '    "quality": ""\n' +
      '  },\n' +
      '  "assistant": { "provider": "", "model": "" },\n' +
      '  "imageCount": 2,\n' +
      '  "shotCount": 6,\n' +
      '  "language": "auto",\n' +
      '  "exportDir": ""\n' +
      '}\n' +
      '\n' +
      '# 兼容任何 OpenAI 图片接口：POST {baseUrl}/images/generations\n' +
      '# 设置里预填：OpenAI / xAI / 火山方舟 / 智谱 / 硅基流动，也可自定义\n' +
      '# 填完点「试画一张」验证；默认一次成稿 1 封面 + 2 配图 + 6 分镜 = 9 张图\n' +
      '\n' +
      '# 2.6.2 起可改 "source": "tool"，复用 DSH 订阅生图工具（如 GPT 订阅）\n' +
      '# 前提是宿主已装 dsh-plugin-subscriptions 且默认执行器支持直接调用\n' +
      '# 仅识别 dsh_subscriptions_image_generate / image_generate 两个工具名\n' +
      '# 纯 Code Mode / PTC 执行器会被判为不可用；失败不会自动退回 HTTP',
    monid:
      '# 在「风格」或「复盘」页点「导入账号」，贴自己的主页链接\n' +
      '# 支持：小红书、抖音、B 站、TikTok、Instagram、X（仅限自己的公开主页）\n' +
      '\n' +
      '# 第一次用要接 Monid，三步：\n' +
      '# 1. 把这句话发给 DeepSeek Harness 的新会话，它会装好 Skill\n' +
      'set up https://monid.ai/SKILL.md\n' +
      '\n' +
      '# 2. 到 app.monid.ai/access/api-keys 注册并创建密钥\n' +
      '\n' +
      '# 3. 在终端写入密钥（不要把密钥发在聊天里）\n' +
      'monid keys add -k 你的密钥 -l main\n' +
      '\n' +
      '# 插件只调用本机 monid 命令，不碰密钥、不经过 shell\n' +
      '# 按次计费：小红书约 $0.02 / 账号，其余平台不到 1 美分\n' +
      '# 再次导入只更新数字；小红书 / 抖音读不到播放量，改按互动算',
    dev:
      '# Host 逻辑测试（node --test test/*.test.js）\n' +
      'npm install && npm test\n' +
      '\n' +
      '# 监听 client/ 并重新打包成 dist/client.js\n' +
      'npm run watch\n' +
      '\n' +
      '# 在隔离的 DSH_HOME 里跑网页版，不碰 ~/.dsh\n' +
      'scripts/dev-sandbox.sh 4311\n' +
      '\n' +
      '# 模拟文字与生图模型，不花额度\n' +
      'node scripts/mock-llm.mjs\n' +
      '# scripts/mock-monid.mjs 是假的 monid 命令，包成可执行文件放到 PATH 最前面\n' +
      '\n' +
      '# 打出可安装的 tgz（prepack 会自动先 build）\n' +
      'npm pack\n' +
      '\n' +
      '# 注意：改了 src/ 要重启 DeepSeek Harness\n' +
      '# 目录：client/ 界面，src/ Host 与成稿流水线，scripts/ 打包与沙盒，\n' +
      '#       assets/ 示例素材，docs/assets/ 展示图'
  };

  var app = VueNS.createApp({
    setup: function () {
      var ref = VueNS.ref;

      /* ---------------- 主题（与全站保持一致） ---------------- */
      var theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      document.body.setAttribute('arco-theme', theme.value);
      function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', theme.value === 'dark');
        document.body.setAttribute('arco-theme', theme.value);
        try { localStorage.setItem(THEME_KEY, theme.value); } catch (e) { /* 隐私模式忽略 */ }
      }

      /* ---------------- 复制命令 ---------------- */
      var copied = ref('');
      var timer = null;

      function fallbackCopy(text) {
        // http 或老旧浏览器下 navigator.clipboard 可能不存在，退回 execCommand
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
        document.body.removeChild(ta);
      }

      function copy(key) {
        var text = TEXTS[key];
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
        copied.value = key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { copied.value = ''; }, 1800);
      }

      return {
        texts: TEXTS,
        theme: theme, toggleTheme: toggleTheme,
        copied: copied, copy: copy
      };
    }
  });

  app.mount('#skill-app');
})();
