# 芸窗 · Ephemera

一个草木绿、纸页感、略带复古气息的日记 PWA 原型。使用 React、TypeScript、Vite 和 Supabase 客户端，桌面与手机共用一套应用。

## 打开与运行

已启动的设计预览：<http://localhost:5173/prototype?variant=A>。

在本目录运行（Node.js 22.12+ 或 24，pnpm）：

```sh
pnpm install
pnpm prototype
```

Windows 已安装依赖时也可双击 `启动芸窗.cmd`。该窗口运行预览服务器，关闭它便停止服务。

底部浮条切换三种结构，地址可直接分享给运行同一项目的人：

| 参数 | 设计 | 特点 |
| --- | --- | --- |
| `?variant=A` | 日记书桌（默认） | 固定侧栏、错落书页、月历与今日一问 |
| `?variant=B` | 时光长卷 | 以日期为线索的长卷，重点是阅读和回顾 |
| `?variant=C` | 专注书写 | 直接展开编辑纸页，旁边是旧日记索引 |

在 `/prototype` 的开发模式中，左右方向键也可切换，编辑输入时不会拦截。正式构建不显示原型浮条。`/` 默认显示 A。

## 已可使用

- 新建、编辑、阅读和删除日记；删除前有确认。
- 即时本机草稿，关闭编辑器后从「写日记」继续；只保留一个未完成草稿。
- 日期、天气、五种心情、自定义标签、收藏。
- 标题、正文、标签全文搜索；标签筛选；月历回顾；心情计数。
- JSON 导出和导入合并。同一 ID 保留更新时间较新的记录。
- 五篇可清除的示例日记。它们会明确标注，不会上传到云端。
- 响应式布局、手机底部导航、键盘焦点、对话框焦点限制及减少动态效果支持。
- PWA 安装清单、192/512px 图标、离线应用缓存、更新提示。
- 字体、森林封面均在本地，离线不依赖第三方图片或字体请求。用户新增文字中字体子集未包含的字使用系统宋体。

## 保存方式

未配置后端时可以完整使用本机模式。日记在当前浏览器的 localStorage，键以 `ephemera-prototype-` 开头。草稿和日记不是端到端加密保险箱；请不要把原型当作正式私密数据服务。

同一个浏览器的不同端口、不同域名属于不同存储空间，因此 `5173` 开发预览和 `4173` 构建预览中的日记各自独立。清除站点数据会清除本机日记，请通过设置导出备份。不要同时在多个标签页编辑同一份日记。

## 接入 Supabase

后端代码已接好，但当前没有提供真实项目地址与密钥，因此云端登录和跨设备备份尚未连接，也未进行真实服务联调。

1. 新建独立的 Supabase 测试项目，在 SQL Editor 执行 `supabase/schema.sql`（首次初始化执行一次）。
2. 复制 `.env.example` 为 `.env`，填写项目 URL 和浏览器可公开的 anon/publishable key。**不要填写 service_role key。**
3. 在 Auth 设置中启用邮箱登录，设置 Site URL，并将实际使用的来源地址（如 `http://localhost:5173/` 或部署后的 HTTPS 地址）加入 Redirect URLs。
4. 重启开发服务，或重新构建。打开「我的小天地」，发送邮箱登录链接。
5. 登录后点「上传本机日记」。另一台设备登录同一个账户后点「取回云端日记」。

表启用了 RLS，按 `auth.uid() = user_id` 限制 SELECT、INSERT、UPDATE、DELETE，匿名角色没有表权限。当前是**主动云端备份/取回**：上传会以本机版本覆盖云端同 ID 记录，取回会按更新时间合并；本机删除不会删除云端备份。此原型没有后台自动同步或多设备编辑冲突处理。

实现参考：[Supabase 邮箱登录](https://supabase.com/docs/reference/javascript/auth-signinwithotp)、[行级权限](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Vite 构建部署](https://vite.dev/guide/static-deploy.html)。

## PWA 与手机

```sh
pnpm exec tsc --noEmit
pnpm exec vite build
pnpm exec vite preview --host 0.0.0.0
```

打开 <http://localhost:4173/> 检查正式构建的 PWA。开发服务器不启用 Service Worker。第一次在线打开并完成缓存后，可在离线状态继续打开、写作和保存。

电脑可通过 Chrome/Edge 菜单安装；iPhone 使用 Safari 的「分享 → 添加到主屏幕」。真实手机安装与 Service Worker 需要 **HTTPS**；`localhost` 是本机测试例外。局域网 HTTP 可查看响应式页面，但不能替代 HTTPS 的 PWA 安装测试。

部署时将 `dist/` 放到支持 HTTPS 的静态站点根目录，并为应用路径设置回退到 `index.html`。当前未发布公网地址。Supabase URL 和 key 是 Vite 构建时变量，修改后需重新构建。

## 原型范围与验证

这是用于比较界面和验证使用感受的可丢弃原型，保存在 `prototype/ephemera` 分支；设计问题和阶段性判断见 `PROTOTYPE.md`。原型阶段已实现本机保存以便验证日记的完整体验，后续正式产品应补上独立账户存储、可靠同步、冲突处理、回收站和服务端集成测试。

已验证 TypeScript 与正式 PWA 构建；浏览器检查了桌面/手机窄屏布局、草稿关闭再打开、日记保存、刷新后搜索与保留、PWA 更新提示，以及停止预览服务器后重新加载缓存应用。未执行真实手机系统安装和真实 Supabase 登录、RLS 隔离联调。

素材：森林照片来自 [Unsplash](https://images.unsplash.com/photo-1441974231531-c6227db76b6e) 的公共图片端点；字体为 [Google Fonts 的 Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc)，许可见 `public/FONT-LICENSE.txt`。植物线稿与窗形图标为本项目 SVG。
