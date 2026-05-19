# Portfolio Heatmap — 应用规格说明书

> 最后更新: 2026-05-17 / 版本: 20260517g

---

## 目录

**外部设计（用户视角的规格）**
1. [应用概览](#1-应用概览)
2. [通用UI规格](#2-通用ui规格)
3. [热力图标签页](#3-热力图标签页)
4. [持仓列表标签页](#4-持仓列表标签页)
5. [关注列表标签页](#5-关注列表标签页)
6. [资产推移标签页](#6-资产推移标签页)
7. [AI咨询标签页](#7-ai咨询标签页)
8. [数据源与更新规格](#8-数据源与更新规格)

**内部设计（实现信息）**
9. [系统架构](#9-系统架构)
10. [文件结构与依赖关系](#10-文件结构与依赖关系)
11. [数据获取详细流程](#11-数据获取详细流程)
12. [状态管理](#12-状态管理)
13. [数据持久化](#13-数据持久化)
14. [安全性·认证的实现](#14-安全性认证的实现)
15. [CSS主题设计](#15-css主题设计)

**运维**
16. [部署步骤](#16-部署步骤)
17. [LLM模型版本的定期维护](#17-llm模型版本的定期维护)
18. [改进路线图](#18-改进路线图)
19. [变更历史](#19-变更历史)

---

# 外部设计（用户视角的规格）

---

## 1. 应用概览

### 这是什么应用

实时可视化·分析日本和美国持有股票及投资信托的私人工具。
供个人投资者（持有资产 5 亿日元以上）快速掌握自己的资产状况。

### 访问信息

| 项目 | 内容 |
|------|------|
| **生产环境URL** | https://shoulang0729.github.io/portfolio/ |
| **托管** | GitHub Pages（静态网站） |
| **支持设备** | PC·智能手机（支持PWA。可添加到主屏幕） |
| **认证** | 启动时使用4位PIN码保护（默认: 1234） |

### 标签页结构

| 标签页 | 概述 |
|------|------|
| **热力图** | 按市值大小排列持有股票的彩色地图 |
| **持仓列表** | 持有股票的详细表格（排序·按期间涨跌率） |
| **关注列表** | 添加·监控非持有的关注股票 |
| **资产推移** | 用图表记录·显示每日总资产 |
| **AI咨询** | 可同时向5个AI咨询投资问题 |

---

## 2. 通用UI规格

### 头部（始终固定）

画面顶部始终显示的固定头部。滚动时不会消失。

**左侧**: 应用标题「Heatmap」＋版本号

**右侧（上段）**:
- **更新频率按钮**: 从 OFF / 实时 / 1分钟 / 5分钟 / 60分钟 中选择
- **主题按钮**: ☼（亮色）/ ☾（暗色）/ A（系统自动）循环切换
- **PIN按钮**: 修改PIN码

**右侧（下段）**:
- **倒计时**: 距下次自动更新的剩余时间
- **状态**: 数据获取状态（黄: 获取中 / 绿: 完成 / 红: 失败）

### 统计栏

显示在头部正下方。右端的眼睛图标可切换显示/隐藏。

| 显示项目 | 内容 |
|---------|------|
| 资产总额 | 全部股票的市值合计（日元） |
| 浮动盈亏 | 与买入成本的差额（日元·%） |
| 各期间盈亏 | 1日·1周·1月…10年各期间的盈亏额和涨跌率 |

> 各期间盈亏是「假设当前持仓在过去也存在」的**模拟值**，并非实际的运作盈亏。

### 主题

| 模式 | 行为 |
|-------|------|
| 亮色 | 始终白色背景 |
| 暗色 | 始终黑色背景 |
| 自动（A） | 自动跟随OS的暗色/亮色设定 |

设置保存在浏览器中（关闭页面后仍保留）。

---

## 3. 热力图标签页

### 画面构成

将持有股票按**与市值成比例的方格大小**进行布局，并按**涨跌率或浮动盈亏率**着色。

**分为2组显示**:
- 美国股·ETF（上方）
- 日本股·ETF·投资信托（下方）

### 颜色含义（遵循日本股票市场惯例）

| 颜色 | 含义 |
|---|------|
| 深红 | 大幅上涨 |
| 浅红 | 小幅上涨 |
| 灰色 | 几乎无变动 |
| 浅绿 | 小幅下跌 |
| 深绿 | 大幅下跌 |

### 颜色模式切换

通过头部下方的期间按钮切换：

| 操作 | 显示内容 |
|------|---------|
| 点击「1日」「1周」…「10年」按钮 | 按该期间涨跌率着色 |
| 点击「浮动盈亏」按钮 | 按买入时起的浮动盈亏率着色 |
| 再次点击「浮动盈亏」 | 返回涨跌率显示 |

### 单元格信息

| 单元格大小 | 显示内容 |
|-----------|---------|
| 大·中单元格 | 股票代号 ＋ 涨跌率（%） |
| 小单元格 | 仅股票代号 |
| 极小单元格 | 不显示任何内容 |

### 工具提示（鼠标悬停时显示）

- 股票名称·代号
- 当前价格·平均买入价格·持有数量
- 市值·浮动盈亏（日元·%）
- 较前日变动（日元·%）
- 投资信托时附注「📊 涨跌率以替代指数近似」

### 打开图表

点击单元格可在模态框中打开该股票的价格图表。

### 价格更新时的动画

自动或手动更新使价格变化时，对应单元格瞬间发光（上涨：变亮 / 下跌：变暗）。

---

## 4. 持仓列表标签页

### 表格列

| 列名 | 内容 | 备注 |
|------|------|------|
| 代号/股票名 | 代号和名称 | 横向滚动时固定在左端 |
| 市场 | 东证 / US / 投信 | |
| 当前价格 | 当前股价 | |
| 1d〜10y | 各期间涨跌率（带颜色） | |
| 浮动盈亏 | 盈亏额（日元） | |
| 盈亏率 | 浮动盈亏率（%、带颜色） | |
| 市值 | （详细列） | 眼睛图标切换显示 |
| 持有数 | （详细列） | 眼睛图标切换显示 |
| 买入价 | （详细列） | 眼睛图标切换显示 |

### 条形图

各行背景显示市值比例的横条（以最大持仓为100%进行比较）。

### 排序

点击列头按该列排序。再次点击切换升序/降序。

---

## 5. 关注列表标签页

### 可执行的操作

- **添加股票**: 在顶部搜索框输入代号或股票名称进行搜索·添加
- **价格监控**: 实时确认添加股票的当前价格·涨跌率
- **排序**: 与持仓列表相同，通过点击列头排序
- **删除**: 行右端的「✕」按钮删除

### 搜索行为

| 输入示例 | 自动判定 |
|-------|---------|
| `AAPL` | 作为美股搜索 |
| `7203` | 作为日股（7203.T）搜索 |
| `9988` | 同时搜索港股（9988.HK） |

搜索结果显示代号·名称·市场·类别（股/ETF/投信/货币）。

### 保存

添加的股票保存在浏览器中（关闭页面后仍保留）。

---

## 6. 资产推移标签页

### 可执行的操作

- **自动记录**: 每次价格更新完成时，自动记录当日总资产
- **图表显示**: 用D3折线图显示记录的每日总资产
- **CSV导出**: 将记录数据下载为CSV文件

### 记录规格

- 1日1条记录（同日多次更新时以最新值覆盖）
- 最大保存1,000日（约3年）
- 保存在浏览器的本地存储

---

## 7. AI咨询标签页

### 可执行的操作

输入投资相关问题后，5个AI同时回答，最终由Claude进行总结。

### AI模型配置

| AI | 模型 | 角色 |
|----|-------|------|
| ChatGPT | GPT-4o | 独立回答 |
| Gemini | gemini-2.0-flash | 独立回答 |
| Grok | grok-3-latest | 独立回答 |
| DeepSeek | deepseek-chat | 独立回答 |
| **Claude** | claude-sonnet-4-6 | 参考其他4个模型的回答进行**总结** |

### 提问流程

1. 输入问题
2. 勾选「包含持仓信息」后，组合信息（股票·市值·盈亏率）会传给AI
3. 点击「发送」
4. ChatGPT / Gemini / Grok / DeepSeek 同时开始回答
5. 4个模型回答齐全后，Claude 参考其他模型的回答，输出最终总结回答

### 对话延续

同一会话内保留对话历史，可进行有上下文的对话。

### API密钥设置

首次使用时需要设置各AI的API密钥。
密钥由Cloudflare Worker服务器端管理，不会保存在浏览器上。

---

## 8. 数据源与更新规格

### 数据来源

| 数据种类 | 主要来源 | 补充 |
|-----------|-----------|------|
| 实时股价·当日涨跌率 | Finnhub API | 失败时自动切换至Yahoo Finance |
| 股价历史（1日〜10年） | Yahoo Finance API | Finnhub精度不足故不使用 |
| AI回答 | 各AI的API | 通过Cloudflare Worker保护API密钥 |

> 所有API通信都经过后端代理（Cloudflare Worker）。
> 由此API密钥不会暴露在浏览器上。

### 自动更新

| 设置 | 行为 |
|------|------|
| OFF | 不自动更新 |
| 实时 | 立即获取1次后，转入1分钟间隔 |
| 1分钟 / 5分钟 / 60分钟 | 按指定间隔自动更新 |

后台（标签页未显示）期间倒计时停止，返回标签页时恢复。

### 汇率

当前未获取USD/JPY实时汇率。
美股的日元换算市值采用「前次价格变动比率」更新，故不反映汇率变动（已记入改进计划）。

### 投资信托的处理

Finnhub·Yahoo Finance未收录的投资信托（ひふみ等），使用对应的替代指数（如：eMaxis Slim 全球股票）的涨跌率近似。工具提示中显示「📊 涨跌率以替代指数近似」。

---

# 内部设计（实现信息）

---

## 9. 系统架构

```
浏览器（GitHub Pages）
    │
    ├── 股价·AI获取 ──→ Cloudflare Worker（portfolio-proxy.shoulang.workers.dev）
    │                        ├── /yahoo   → Yahoo Finance API
    │                        ├── /finnhub → Finnhub API（API密钥在Worker内管理）
    │                        └── /ai/*    → 各AI API（API密钥在Worker内管理）
    │
    └── 本地保存
             ├── localStorage   → 主题·关注列表·PIN·资产历史
             └── sessionStorage → 认证令牌·AES密钥·历史价格缓存
```

### Cloudflare Worker 端点一览

| 端点 | 方法 | 用途 |
|--------------|---------|------|
| `/yahoo?url=<encoded>` | GET | Yahoo Finance 代理 |
| `/finnhub?path=<path>&<params>` | GET | Finnhub 代理 |
| `/ai/openai` | POST | OpenAI 代理 |
| `/ai/gemini` | POST | Gemini 代理 |
| `/ai/grok` | POST | Grok 代理 |
| `/ai/deepseek` | POST | DeepSeek 代理 |
| `/ai/claude` | POST | Anthropic 代理 |

Worker 的环境变量（Cloudflare Secrets）:
`FINNHUB_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GROK_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY`

---

## 10. 文件结构与依赖关系

### 前端（GitHub Pages）

| 文件 | 角色 |
|---------|------|
| `index.html` | HTML骨架·脚本加载顺序控制 |
| `auth.js` | PIN认证·AES-GCM加密密钥派生·PIN修改 |
| `positions.js` | 持仓数据·期间设置（PERIODS） |
| `state.js` | 全局常量(C)·应用状态(state) |
| `utils.js` | 格式化器·颜色计算·表格辅助函数 |
| `data.js` | API通信·价格获取·历史缓存 |
| `heatmap.js` | D3.js 树状图绘制 |
| `chart.js` | D3.js 个股图表（模态框） |
| `stock-list.js` | 持仓列表标签页（表格·排序·条形图） |
| `watchlist.js` | 关注列表标签页 |
| `history.js` | 资产推移标签页（日次记录·图表） |
| `ai-tab.js` | AI咨询标签页（5模型并行·对话延续） |
| `app.js` | 初始化·标签切换·主题·自动更新 |
| `portfolio.css` | 全部样式（主题变量·响应式） |

### 后端（Cloudflare Workers）

| 文件 | 角色 |
|---------|------|
| `worker/src/index.js` | Worker本体（路由·代理处理） |
| `worker/wrangler.toml` | Cloudflare设置（Worker名·环境变量） |

### 脚本加载顺序

```
auth.js → positions.js → state.js → utils.js → data.js
→ heatmap.js → chart.js → stock-list.js → watchlist.js
→ history.js → ai-tab.js → app.js
```

> **当前课题**: 所有函数暴露在全局作用域。ES Modules 化已记入改进计划。

### 依赖关系

```
positions.js ──────────────────────────────────────────────┐
state.js ───────────────────────────────────────────────┐  │
utils.js (← state, positions, D3) ───────────────────┐  │  │
data.js  (← state, utils, positions) ─────────────┐  │  │  │
auth.js  （独立·仅加密密钥被他模块引用）              │  │  │  │
                                                     │  │  │  │
heatmap.js    (← state, utils, positions, D3) ───────┤  │  │  │
chart.js      (← state, utils, data, D3) ────────────┤  │  │  │
stock-list.js (← state, utils, positions) ───────────┤  │  │  │
watchlist.js  (← state, utils, data, positions) ─────┤  │  │  │
history.js    (← state, utils, positions) ───────────┤  │  │  │
ai-tab.js     (← auth, positions) ───────────────────┤  │  │  │
app.js        (← 全模块) ────────────────────────────┘──┘──┘──┘
```

---

## 11. 数据获取详细流程

### 实时价格获取（`fetchLivePrice` in data.js）

```
fetchLivePrice(ySymbol)
  │
  ├─① Finnhub（经Worker: /finnhub?path=/quote&symbol=TYO:9983）
  │    返回值: { price: d.c, dayPct: d.dp }
  │    跳过条件: d.c === 0（周末·未收录股票）
  │
  └─② Yahoo Finance（失败时回退）
       经Worker: /yahoo?url=<encoded Yahoo Finance URL>
       进一步失败时: corsproxy.io → allorigins 顺序尝试
```

### 历史数据获取（`fetchAllHistorical` in data.js）

仅使用 Yahoo Finance（Finnhub因股票分割未调整故不使用）。

```
fetchAllHistorical(range)  range = '1y' | '5y' | '10y'
  ├─ 防止重复: 向 fetchingRanges 添加 range（结束时删除）
  ├─ 跳过已缓存的股票
  ├─ 每批5只股票获取（间隔300ms）
  └─ 失败的股票在2秒后重试
```

### 全股票批量更新（`refreshPrices` in data.js）

```
refreshPrices()
  ├─ 每批5只股票并行执行 fetchLivePrice
  ├─ 失败股票2秒后重试
  └─ 价格更新后的计算
       JPY计价: value = price × shares
       USD计价: 以前次价格比率缩放日元计价 value
```

### 异常价格跳过

| 位置 | 条件 | 处理 |
|------|------|------|
| `refreshPrices` | live.price / 前次价格 小于0.1 或 大于10 | 跳过（保留前次值） |
| 历史缓存更新 | price / 最近历史值 小于0.3 或 大于3.0 | 跳过 |

### 代号转换（Yahoo Finance → Finnhub）

| Yahoo Finance | Finnhub |
|--------------|---------|
| `9983.T` | `TYO:9983` |
| `AAPL` | `AAPL` |

### 股票分割自动调整（`applySplitCorrection`）

将1日内 ±50% 以上的价格变动判定为股票分割，溯及性自动调整过往数据。

---

## 12. 状态管理

应用状态用 `state.js` 的全局 `state` 对象统一管理（不使用Redux等）。

### 主要 state 字段

| 字段 | 说明 |
|-----------|------|
| `colorMode` | 热力图的颜色模式（`'change'` 或 `'pnl'`） |
| `changePeriod` | 选中的期间ID（`'1d'`〜`'10y'`） |
| `historicalCache` | 历史数据缓存（`{range: {symbol: [{date, close}]}}`） |
| `fetchingRanges` | 获取中的范围 Set（防止重复请求） |
| `yahooCrumb` / `yahooCrumbExpiry` | Yahoo Finance 认证令牌和有效期（55分钟） |
| `autoSec` / `countdownVal` | 自动更新间隔和剩余秒数 |
| `themeMode` | 主题模式（`'auto'` / `'light'` / `'dark'`） |
| `listSortCol` / `listSortDir` | 持仓列表的排序状态 |
| `wlSortCol` / `wlSortDir` | 关注列表的排序状态 |
| `activeTab` | 当前的标签页名 |
| `watchlist` | 关注列表股票数组 |
| `prevPrices` | 价格更新动画用的前次价格缓存 |

---

## 13. 数据持久化

### localStorage（关闭浏览器后仍保留）

| 键 | 内容 | 负责 |
|------|------|------|
| `hm-theme` | 主题模式 | app.js |
| `hm-watchlist` | 关注列表股票（JSON数组） | watchlist.js |
| `hm-pin-hash` | 修改后PIN的SHA-256哈希 | auth.js |
| `hm-asset-history` | 日次总资产记录（JSON数组，最多1,000条） | history.js |

### sessionStorage（关闭标签页后消失）

| 键 | 内容 | 负责 |
|------|------|------|
| `hm-auth-v1` | 已认证标志 | auth.js |
| `hm-enc-key-v1` | AES-256-GCM 密钥（Base64） | auth.js |
| `hm-hist-cache` | 历史价格缓存（重载时恢复，节省API请求） | data.js |

---

## 14. 安全性·认证的实现

### PIN认证流程（`auth.js`）

```
启动
  └─ 确认 sessionStorage['hm-auth-v1']
       ├─ 有 → 已认证，显示应用
       └─ 无 → 全屏显示PIN键盘
                   └─ 4位输入 → SHA-256哈希对照
                                 ├─ 一致 → PBKDF2派生AES-256-GCM密钥（10万次迭代）
                                 │         → sessionStorage 保存密钥·认证标志
                                 └─ 不一致 → 5次失败后锁定30秒
```

### 通过 Cloudflare Worker 保护 API 密钥

AI 的 API 密钥和 Finnhub API 密钥保存在 Cloudflare Worker 的 Secrets（环境变量）中。
浏览器的 JavaScript 代码中完全不包含 API 密钥。

---

## 15. CSS主题设计

主题通过 `html[data-theme]` 属性控制。`applyTheme()` 用 matchMedia 解析 `auto`，始终明确设置 `"light"` 或 `"dark"`。

### 主要 CSS 变量

| 变量 | 亮色 | 暗色 |
|------|-------|-------|
| `--bg` | #F2F2F7 | #000000 |
| `--surface` | #FFFFFF | #1C1C1E |
| `--text` | #1C1C1E | #FFFFFF |
| `--text2` | #8E8E93 | #8E8E93 |
| `--border` | #C6C6CB | #3A3A3C |
| `--null-cell` | #E5E5EA | #2C2C2E |

### 热力图的颜色尺度

| 期间 | scale值 | 含义 |
|------|---------|------|
| 1日 | 4 | ±4% 达最大色 |
| 1周 | 8 | ±8% 达最大色 |
| 1月 | 15 | ±15% 达最大色 |
| 1年 | 65 | ±65% 达最大色 |
| 浮动盈亏 | 50 | ±50% 达最大色 |

---

# 运维

---

## 16. 部署步骤

### 前端（GitHub Pages）

```bash
# 1. 更新 index.html 的全部 ?v= 参数
#    格式: ?v=YYYYMMDDX（例: 20260516a, 20260516b, ...）
#    同日多次发布时末尾字母按 a, b, c... 推进

# 2. 提交＆Push（VSCode Source Control 或 git 命令）
git add -A
git commit -m "deploy: vYYYYMMDDX"
git push origin main

# 注意: push.sh 包含GitHub令牌已在 .gitignore 注册。
#       绝对不要提交。
```

### 后端（Cloudflare Worker）

```bash
cd worker
./node_modules/.bin/wrangler deploy
```

仅添加·修改API密钥时用 `wrangler secret put <KEY_NAME>` 应对（无需重新部署）。

---

## 17. LLM模型版本的定期维护

AI 咨询标签页使用的各 LLM 模型名通过 **Cloudflare Worker `/ai/models` 端点自动获取·KV缓存1小时**，每次打开 AI 标签页时切换至最新列表。原则上无需手动更新，但以新模型动作确认及 preferred default 复审为目的，**每2周1次**进行清点。

### 自动更新的机制

| 层 | 实现 | 备注 |
|---|---|---|
| Worker | [`worker/src/index.js`](worker/src/index.js) `handleAIModels()` 并行获取各供应商 `/v1/models` 聚合JSON。`KV: ai:models:v1` 缓存1小时 | 各家失败时仅该供应商返回 `null` 进行回退 |
| Front | [`src/ai-tab.js`](src/ai-tab.js) `_refreshModelVersionsFromWorker()` 在 AI 标签页首次显示时 fetch → 动态替换各 `<select>` | preferred（`AI_MODELS[].versions[0]`）若包含在动态列表则固定在首位 |
| 回退 | Worker `/ai/models` 失败时，AI_MODELS 的硬编码版照用 | 硬编码版也是本节的检查对象 |

### 维护对象
[src/ai-tab.js](src/ai-tab.js) 的 `AI_MODELS` 数组的各 `versions` 属性。
**首位元素作为默认值**，按 `versions[0]` 选择规格（[src/ai-tab.js#_getSelectedVersion](src/ai-tab.js)）。

### 每2周的作业步骤

| # | 供应商 | 官方模型列表确认地址 | 检查要点 |
|---|---|---|---|
| 1 | OpenAI | https://platform.openai.com/docs/models | 推荐 chat model（gpt-5.x / gpt-4.x / o-series）的最新名。也确认 `max_tokens` 规格变更 |
| 2 | Google Gemini | https://ai.google.dev/gemini-api/docs/models | 仅采用带 "Stable" 标签的模型。默认采用 `gemini-X.X-flash` 系 |
| 3 | xAI Grok | https://console.x.ai/ → Models（需登录） | 账户 "Available models" 中显示的项目。带 `Try now` 按钮的语言模型可使用 |
| 4 | DeepSeek | https://platform.deepseek.com/api-docs/api/list-models | 需有余额，仅在继续使用时。`deepseek-chat` / `deepseek-reasoner` |
| 5 | Anthropic Claude | https://docs.claude.com/en/docs/about-claude/models | 最新 Sonnet / Opus / Haiku 的正式 ID。`claude-sonnet-4-X` / `claude-opus-4-X` / `claude-haiku-4-X-YYYYMMDD` |

### 更新步骤（代码变更）
1. 在上表各 URL 确认模型名
2. 编辑 `src/ai-tab.js` 的 `AI_MODELS` 对应的 `versions` 数组
   - **数组首位是默认值**（放置最稳妥的通用模型）
   - 已废弃（deprecated）模型移除
3. 上调 `index.html` 的版本 `?v=YYYYMMDDX`
4. 在 SPEC.md 本节追加「最后确认日」
5. 动作确认: AI 咨询标签页对各 LLM 单独勾选 → 发送问题 → 确认 200 OK

### 最后确认日

| 日期 | 确认者 | 变更 |
|---|---|---|
| 2026-05-17 | shoulang | GPT 追加 `gpt-5.4-mini` 并置首位／Gemini 全部更换为 2.5 系GA + 3.1-flash-lite／Grok 全部更换为 `grok-4.3` 系／DeepSeek 临时禁用（无余额） |

### 下次维护预定日

**2026-05-31** （上述2周后）

---

## 18. 改进路线图

### 已完成

| 功能 | 版本 |
|------|----------|
| sessionStorage 的历史缓存持久化 | 20260516a |
| 资产推移标签页（history.js）的新实现 | 20260516a |
| AI 咨询的对话延续化·Claude 流式 | 20260516a |
| 价格更新时的单元格闪烁动画 | 20260516a |
| 持仓列表的代号列 sticky 固定 | 20260516a |
| 首次数据获取中的骨架显示 | 20260516a |
| 系统主题的自动跟随改善 | 20260516a |
| Cloudflare Worker 的 API 代理实现 | 20260516b |

### 计划进行

| # | 功能 | 概述 |
|---|------|------|
| 1 | **ai-tab.js 的 Worker 对应** | 将 AI API 密钥完全迁移至 Worker，废止浏览器端的密钥管理 |
| 2 | **USD/JPY 汇率的实时获取** | 用 Yahoo Finance `/USDJPY=X` 获取，使美股的日元换算准确化 |
| 3 | **再平衡建议面板** | 显示目标比率和当前比率的差异 |

### 探讨中

- ES Modules 化（脱离全局作用域）
- 资产赠与·税务模拟器

---

## 19. 变更历史

| 版本 | 日期 | 内容 |
|-----------|------|------|
| 20260517n | 2026-05-17 | LLM 模型一次性检查：GPT 首位置 `gpt-5.4-mini`／Grok 全部更换为 `grok-4.3` 系（旧 grok-2 系404）／Gemini 更新为 2.5 系GA+3.1-flash-lite（旧 2.0-flash deprecated）／DeepSeek 临时禁用（无余额）。新设规格说明书第17章「LLM 模型版本的定期维护（每2周）」。 |
| 20260517h | 2026-05-17 | ChatGPT 标签恢复原本的绿色背景＋白字／标题和 Passkey 注册名统一为「Portfolio Manager」／Pull-to-refresh 行为修复（对应 iOS Safari PWA）／max_tokens 1200→4000 |
| 20260517g | 2026-05-17 | 将 AI 咨询标签页的系统提示词高度化为「投资陪练 AI 人格」（GS 高级分析师＋家族办公室 PM）。在系统提示词开头常时附加 PER 历史分析·仓位计算·主动风险指摘·买卖判断框架·核心卫星 ETF 区分等6个分析框架。新设 docs/ai-system-prompt.md / src/ai-system-prompt.js。 |
| 20260517f | 2026-05-17 | **大规模重构**: ① Bug 修复（「整理股票」模态框删除 Bug：保存后追加 renderStockList/renderWatchlist 调用＋以索引为基础的判定对应重复 symbol）、移动 Heatmap 标题扩大（17px→22px）、OpenAI 标签颜色反转（白底＋绿字＋绿边框）。② 文件分割: 新设 `funds.js`（投信定义整合）、新设 `csv.js`（CSV解析切出）、`portfolio.css` 分为 5 个（01-base/02-tables/03-misc/04-auth/05-ai-tab）、`import.js` 分为 3 个（import-parse/positions-store/import-ui）、`auth.js` 分为 4 个（auth-pin/crypto/passkey/ui）。③ DOM 松耦合化: 全部 onclick/oninput/onchange 属性 (HTML 侧 43 处) 替换为 `data-action` / `data-arg` / `data-event`，在 app.js 的 `_bindActionDispatcher` 进行 event delegation 配线。 |
| 20260517d | 2026-05-17 | 追加「整理股票」模态框（从认证后菜单删除错误注册·重复） |
| 20260517c | 2026-05-17 | 取入 UI 改善: 现存股票部分折叠化、KV 保存超时延长30秒、错误消息改善 |
| 20260517b | 2026-05-17 | 投信代号集中为 ひふみ投信/ひふみXO/ひふみMS（更新 FUND_SYMBOL_PATTERNS） |
| 20260517a | 2026-05-17 | マネフォ图像解析切换为 GPT-4o Vision（Anthropic 额度不足对应）、KV PIN 哈希重置 |
| 20260516n | 2026-05-16 | マネックス取入 PIN 再输入 UI 追加、CORS X-Pin-Hash 修复、マネフォ错误详细显示 |
| 20260516b | 2026-05-16 | Cloudflare Worker 代理实现（Yahoo Finance·Finnhub·AI API），API 密钥迁移至 Worker Secrets |
| 20260516a | 2026-05-16 | sessionStorage 缓存·资产推移标签页·AI 对话延续化·闪烁动画·代号列固定·骨架显示·主题自动跟随改善 |
| 20260514a | 2026-05-14 | 组合更新（1306追加·JPST追加·GDX/SHV 删除·股数·价格更新） |
| 20260417j | 2026-04-17 | 组合更新（1629分割·8050分割·PLTR追加）·Finnhub 异常价格跳过修复 |
| 20260322f | 2026-03-22 | PWA 图标实现（SVG favicon·PNG 各尺寸·manifest.json） |
| 20260322e | 2026-03-22 | 投信追加（ひふみ3只·PIMCO-ST） |
| 20260322b | 2026-03-22 | 关注列表的智能手机横向滚动修复 |
| 20260322a | 2026-03-22 | Finnhub 实现（优先→Yahoo 回退）·组合更新 |
| 20260311o | 2026-03-11 | Yahoo Finance 稳定性改善（追加 query2·批量获取·重试） |
| 20260311n | 2026-03-11 | 市场排序 comparator Bug 修复·关注列表市场徽章统一 |
| 20260311m | 2026-03-11 | 重构: makeTh/makePctCell 共通化 |
| 20260311l | 2026-03-11 | 向持仓列表/关注列表追加市场列·市场排序 |
| 20260311k | 2026-03-11 | 关注列表标签页实现 |
