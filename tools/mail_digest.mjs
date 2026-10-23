// 生成「AI 资讯早报」邮件 HTML —— 读取 hot-data.js，输出 mail-digest.html
// 用法：node tools/mail_digest.mjs  （在 Actions 中每日定时调用）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const raw = fs.readFileSync(path.join(root, 'assets/js/hot-data.js'), 'utf8');
const data = JSON.parse(raw.slice(raw.indexOf('=') + 1).replace(/;\s*$/, ''));

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const siteUrl = 'https://jason19960330.github.io/website/';
const today = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date());
const dataDate = (data.updatedAt || '').slice(0, 10);

// 当前热点 Top 10
const topicRows = (data.topics || []).slice(0, 10).map((t, i) => `
  <tr>
    <td style="padding:10px 8px;border-bottom:1px solid #eee;vertical-align:top;width:34px;">
      <span style="display:inline-block;min-width:24px;text-align:center;font-weight:700;color:${i < 3 ? '#d4380d' : '#8c8c8c'};">${t.rank || i + 1}</span>
    </td>
    <td style="padding:10px 8px;border-bottom:1px solid #eee;vertical-align:top;">
      <a href="${esc(t.url)}" style="color:#1f2328;text-decoration:none;font-weight:600;font-size:15px;line-height:1.5;">${esc(t.title)}</a>
      <div style="margin-top:3px;color:#8c8c8c;font-size:12px;">${esc((t.sourceNames || []).slice(0, 3).join(' · '))}${(t.sourceNames || []).length > 3 ? ' 等' : ''}</div>
    </td>
    <td style="padding:10px 8px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;white-space:nowrap;color:#8c8c8c;font-size:12px;">
      ${t.sourceCount || 0} 源 · ${t.signalCount || 0} 信号
    </td>
  </tr>`).join('');

// 精选条目（取 score 最高的 10 条）
const items = [...(data.items || [])].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
const itemCards = items.map((it) => `
  <div style="margin:0 0 14px;padding:14px 16px;background:#fafafa;border-radius:10px;">
    <a href="${esc(it.url)}" style="color:#1f2328;text-decoration:none;font-weight:600;font-size:15px;line-height:1.5;">${esc(it.title)}</a>
    ${it.summary ? `<p style="margin:6px 0 0;color:#595959;font-size:13px;line-height:1.7;">${esc(it.summary).slice(0, 140)}${esc(it.summary).length > 140 ? '…' : ''}</p>` : ''}
    <p style="margin:8px 0 0;color:#8c8c8c;font-size:12px;">${esc(it.sourceName || '')}${it.category ? ' · ' + esc(it.category) : ''}${it.score ? ' · 评分 ' + it.score : ''}</p>
  </div>`).join('');

const html = `<!doctype html>
<html lang="zh-CN"><body style="margin:0;padding:0;background:#f2f3f5;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="background:#fff;border-radius:14px;overflow:hidden;">
    <div style="background:#1f2328;color:#fff;padding:22px 24px;">
      <div style="font-size:20px;font-weight:700;">AI 资讯早报</div>
      <div style="margin-top:4px;font-size:13px;color:#b8bcc4;">${esc(today)} · 数据更新于 ${esc(dataDate)}</div>
    </div>
    <div style="padding:20px 24px;">
      <div style="font-size:15px;font-weight:700;color:#1f2328;margin:0 0 4px;">当前热点 Top 10</div>
      <table style="width:100%;border-collapse:collapse;">${topicRows}</table>

      <div style="font-size:15px;font-weight:700;color:#1f2328;margin:24px 0 10px;">今日精选</div>
      ${itemCards}

      <a href="${siteUrl}" style="display:block;margin-top:18px;padding:12px;text-align:center;background:#1f2328;color:#fff;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">前往 AI 速览查看完整内容 →</a>
    </div>
    <div style="padding:14px 24px;background:#fafafa;color:#8c8c8c;font-size:12px;line-height:1.6;">
      本邮件由你的个人站点自动生成（数据源：AIHOT 公开只读接口），每天早上 8:30 发送。<br>
      不想再收到？前往 GitHub 仓库禁用「每日 AI 资讯早报」工作流即可。
    </div>
  </div>
</div>
</body></html>`;

fs.writeFileSync(path.join(root, 'mail-digest.html'), html);
console.log(`[mail-digest] 已生成 mail-digest.html：热点 ${(data.topics || []).length} 条 · 精选 ${items.length} 条 · 数据日期 ${dataDate}`);
