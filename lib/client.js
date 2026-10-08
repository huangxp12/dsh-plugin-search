/**
 * 插件搜索（plugin-search）——浏览器半（手写 bundle，无需构建链）。
 *
 * ## 为什么是 DOM 注入，而不是注册一个 slot
 *
 * 「插件」页由 @deepseek-ai/dsh-client-ui-plugin-manager 拥有。它对外声明的扩展位只有
 * 四个：plugins.item（官方插件卡片）、plugins.bundle.config / plugins.row.config
 * （某个包的配置页）、plugins.detail.*（详情页）。**列表级的工具栏没有槽位**；而承载
 * 该页的 `main` 是 keyed slot，"plugins" 这个 key 已经被它占了 —— 想从槽位走这条路，
 * 只能整页顶替它自带的界面，那是 shadowing 外壳 UI，代价和风险都不是「加个搜索框」
 * 该付的。
 *
 * 所以这里用与 dshmarket 的 settings-nav-icon 同一套做法：认准页面自带的稳定
 * data-* 契约，把搜索框挂进去，按关键词切换卡片的显示：
 *
 *   [data-plugin-panel]                        页面根（列表态还有 direct child <header>）
 *   [data-plugin-group="official"|"bundles"]   分组；整组无命中时整组隐藏
 *   [data-plugin-package="<包名>"]              一个已安装/官方 bundle 的卡片
 *   [data-plugin-item="<id>"]                  一个官方插件（注册过配置页）的卡片
 *
 * 这些属性是外壳自己写在 JSX 上的（见 ui-plugin-manager 的 PackageCard / ItemCard /
 * renderGroup），是它的对外 DOM 契约，不随构建改变的哈希类名漂移。CSS 模块类名一个
 * 都没用 —— 外壳改版时最坏情况是少一个搜索框，而不是把页面搞坏。
 *
 * ## 边界
 *
 * 只读 DOM：改的是「显示哪几张卡片」和挂在页头下的一条搜索条，不碰数据、不发请求、
 * 不写会话、不动 Loader 的启用状态。搜索词为空时页面的 DOM 与外壳自己渲染的完全一致。
 */

window.__ModuleLoader__.load({
	id: "dsh-plugin-search",
	factory: () => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const NS = "dsh-plugin-search";
		const STYLE_ID = "dsh-plugin-search-style";
		/** 命中失败的元素标记（卡片与分组共用）。样式表里只有它一条 display:none。 */
		const HIDDEN_ATTR = "data-dsh-plugin-search-hidden";
		/** 搜索条自己的锚点，同步逻辑靠它认领自己创建的节点。 */
		const BAR_ATTR = "data-dsh-plugin-search-bar";

		const SELECTORS = Object.freeze({
			panel: "[data-plugin-panel]",
			card: "[data-plugin-package], [data-plugin-item]",
			/** 只认分组；加载骨架的 <section> 没有这个属性，所以不会被误伤。 */
			group: "[data-plugin-group]",
			loading: "[data-plugin-loading]",
			idPackage: "data-plugin-package",
			idItem: "data-plugin-item",
		});

		/** 命中（未被我们藏起来）的卡片。分组是否该显示，看的就是组里还有没有它。 */
		const VISIBLE_CARD = `[${SELECTORS.idPackage}]:not([${HIDDEN_ATTR}]), `
			+ `[${SELECTORS.idItem}]:not([${HIDDEN_ATTR}])`;

		const DICT = {
			zh: {
				placeholder: "搜索插件…",
				label: "搜索插件",
				clear: "清除搜索",
				noResults: "没有匹配的插件",
				status: "{shown} / {total}",
			},
			en: {
				placeholder: "Search plugins…",
				label: "Search plugins",
				clear: "Clear search",
				noResults: "No matching plugins",
				status: "{shown} / {total}",
			},
		};

		// ── 纯函数（导出给测试；不碰 DOM） ────────────────────────────────────

		/**
		 * 查询词 → 关键词数组。
		 *
		 * 空白分隔、全部小写、丢掉空串。多个关键词之间是 AND：每个词都要在卡片文本里
		 * 出现才算命中 —— 输入「task 看板」比「task看板」宽容，也比 OR 少一堆噪音。
		 */
		function splitQuery(query) {
			return String(query ?? "")
				.toLowerCase()
				.split(/\s+/)
				.filter((term) => term.length > 0);
		}

		/**
		 * haystack 是否包含全部关键词（大小写不敏感的子串匹配）。空关键词表 = 全命中。
		 *
		 * 两侧都在这里转小写：splitQuery 已经归一过了，但匹配本身不该依赖调用方的纪律 ——
		 * 传进来大写词也应当照样命中。
		 */
		function matchesQuery(haystack, terms) {
			const hay = String(haystack ?? "").toLowerCase();
			for (const term of terms) {
				if (!hay.includes(String(term ?? "").toLowerCase())) return false;
			}
			return true;
		}

		/**
		 * 当前语言：优先问 DSH 的 locale 服务（跟界面语言一致），退化到浏览器语言。
		 *
		 * 刻意不做 locale.register()：本插件的 UI 是一条搜索框，不注册命名空间就不必
		 * 依赖字典注册的成功与否；拿不到服务时行为也完全可预期。
		 */
		function resolveLang(ctx) {
			try {
				const active = ctx && ctx.locale && ctx.locale.getSnapshot
					? ctx.locale.getSnapshot().active
					: undefined;
				if (typeof active === "string" && active.length > 0) return active;
			} catch (error) {
				/* 服务缺失或尚未就绪：往下退化。 */
			}
			try {
				if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
			} catch (error) {
				/* 无 navigator：继续退化。 */
			}
			return "en";
		}

		/** zh* 用中文，其余英文。 */
		function pickDict(lang) {
			return String(lang ?? "").toLowerCase().startsWith("zh") ? DICT.zh : DICT.en;
		}

		/** {name} 占位替换。 */
		function format(text, params) {
			let out = String(text);
			if (params !== undefined && params !== null) {
				for (const [key, value] of Object.entries(params)) {
					out = out.split(`{${key}}`).join(String(value));
				}
			}
			return out;
		}

		// ── 样式 ─────────────────────────────────────────────────────────────

		/**
		 * 视觉全部走外壳的主题 token，颜色/圆角自动跟随明暗主题，不写死任何色值。
		 * 少数 token 取不到时给了退化值（var() 的第二参数），缺失的 token 不会让整条
		 * 声明失效，也不会让搜索框变成浏览器默认外观。
		 */
		const CSS = `
[${BAR_ATTR}] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  max-width: 100%;
  /* 兜底：data-window-drag-recall 已经让外壳放行，这里再声明一次，插件在非
     darwin（外壳那套规则带 html[data-platform=darwin] 前缀）也保持一致。 */
  -webkit-app-region: no-drag;
}
[${BAR_ATTR}] .dps-field {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  flex: 1 1 180px;
  min-width: 0;
  max-width: 320px;
  height: 32px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l4, var(--dsw-alias-border-l1));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1);
}
[${BAR_ATTR}] .dps-field:focus-within {
  border-color: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary));
}
[${BAR_ATTR}] .dps-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
[${BAR_ATTR}] .dps-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
[${BAR_ATTR}] .dps-input::placeholder {
  color: var(--dsw-alias-label-dimmed, var(--dsw-alias-label-caption));
}
[${BAR_ATTR}] .dps-input::-webkit-search-cancel-button {
  display: none;
}
[${BAR_ATTR}] .dps-clear {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-caption);
  cursor: pointer;
}
[${BAR_ATTR}] .dps-clear:hover {
  color: var(--dsw-alias-label-primary);
}
[${BAR_ATTR}] .dps-clear[hidden] {
  display: none;
}
[${BAR_ATTR}] .dps-status {
  color: var(--dsw-alias-label-caption);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
[${HIDDEN_ATTR}] {
  display: none !important;
}
`;

		/**
		 * 确保样式表在文档里存在，返回它。
		 *
		 * 为什么不能只在 apply() 里插一次：document.head 不是我们的地盘 —— 插件热更新、
		 * 禁用再启用、外壳整体重建 <head>，都可能让我们的 <style> 消失，而 apply() 早已
		 * 跑过。所以每次同步都顺手确认一次（getElementById 很便宜），不存在就补回来；
		 * 存在但内容不是我们的（同 id 被顶替）就改写而不是叠加。
		 */
		function ensureStyles() {
			if (typeof document === "undefined" || !document.head) return null;
			let tag = document.getElementById(STYLE_ID);
			if (!tag) {
				tag = document.createElement("style");
				tag.id = STYLE_ID;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			} else if (tag.textContent !== CSS) {
				tag.textContent = CSS;
			}
			return tag;
		}

		/** 只在内容真的变了才写 textContent —— 重复赋同值会造出 mutation，白白喂自己的观察者。 */
		function setText(el, text) {
			if (el && el.textContent !== text) el.textContent = text;
		}

		// ── 插件主体 ─────────────────────────────────────────────────────────

		/** 建立一条搜索条（自己建节点，不用 React —— 它不属于外壳的渲染树）。 */
		function buildBar(dict) {
			const bar = document.createElement("div");
			bar.setAttribute(BAR_ATTR, "");
			// 页头整块是窗口拖拽区（外壳给 <header> 打了 data-window-drag，macOS 上整块
			// 可拖动）。外壳为「拖拽区里的可交互内容」准备了反标记 data-window-drag-recall
			// （`[data-window-drag-recall]{-webkit-app-region:no-drag}`），这里就用它 ——
			// 比在自有样式表里重写一遍更可靠：即使我们的 <style> 还没插进去，外壳的规则
			// 也已经生效，不会出现「点搜索框变成拖窗口」。
			bar.setAttribute("data-window-drag-recall", "");

			const field = document.createElement("div");
			field.className = "dps-field";

			const icon = document.createElement("span");
			icon.className = "dps-icon";
			icon.setAttribute("aria-hidden", "true");
			icon.innerHTML =
				'<svg viewBox="0 0 16 16" width="16" height="16" fill="none" '
				+ 'stroke="currentColor" stroke-width="1.4" stroke-linecap="round">'
				+ '<circle cx="7" cy="7" r="4.4"/><path d="M10.4 10.4 14 14"/></svg>';

			const input = document.createElement("input");
			input.className = "dps-input";
			input.type = "search";
			input.autocomplete = "off";
			input.spellcheck = false;
			input.setAttribute("enterkeyhint", "search");

			const clear = document.createElement("button");
			clear.className = "dps-clear";
			clear.type = "button";
			clear.hidden = true;
			clear.innerHTML =
				'<svg viewBox="0 0 16 16" width="12" height="12" fill="none" '
				+ 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round">'
				+ '<path d="M4 4 12 12M12 4 4 12"/></svg>';

			const status = document.createElement("span");
			status.className = "dps-status";
			status.setAttribute("role", "status");
			status.setAttribute("aria-live", "polite");

			field.appendChild(icon);
			field.appendChild(input);
			field.appendChild(clear);
			bar.appendChild(field);
			bar.appendChild(status);

			return { bar, input, clear, status };
		}

		/** 按当前语言刷新文案（语言切换时调用，不重建节点 —— 用户输入的那半不能丢）。 */
		function relabel(ui, dict) {
			ui.input.placeholder = dict.placeholder;
			ui.input.setAttribute("aria-label", dict.label);
			ui.clear.setAttribute("aria-label", dict.clear);
		}

		function apply(ctx) {
			if (typeof document === "undefined" || !document.body) {
				console.warn(`[${NS}] 没有 document：本插件只在 Web GUI 里工作`);
				return;
			}

			ctx.effect(() => {
				const ui = buildBar(pickDict(resolveLang(ctx)));
				let dict = pickDict(resolveLang(ctx));
				/** 当前查询词。住在 fiber 里：卡片被 React 重挂后仍然有效。 */
				let query = "";
				/** 是否有元素被我们藏起来了（用于决定清理时要不要再扫一遍文档）。 */
				let hidAnything = false;
				let disposed = false;
				let scheduled = false;
				let observer = null;

				// ── 同步：把搜索条放到该在的位置，并按关键词切换卡片显示 ──────

				/**
				 * 找到搜索条的落点，以及「现在是不是该有搜索条」。
				 *
				 * 列表态才有 direct child <header>；详情页没有，所以详情页自然不显示搜索条。
				 * 落点优先是页头左侧那块（标题 + 说明下面），退化到页头之后 —— 两处都不依赖
				 * CSS 模块的哈希类名。
				 *
				 * 多个 [data-plugin-panel] 同时存在时（理论上不会：main 是 keyed 单槽），挑
				 * 有卡片或在加载的那个，避免把搜索条挂到一个空壳面板上。
				 *
				 * @param panels - 已由调用方查好的面板集合（避免重复查一遍文档）。
				 */
				function findSlot(panels) {
					let panel = null;
					for (const candidate of panels) {
						if (candidate.querySelector(`${SELECTORS.card}, ${SELECTORS.loading}`)) {
							panel = candidate;
							break;
						}
					}
					if (panel === null) panel = panels[0] ?? null;
					if (panel === null) return null;
					const header = panel.querySelector("header");
					if (!header) return null;
					const lead = header.firstElementChild;
					// 追加到页头左侧那块的最后 —— 这是唯一不会跟 React 的 children
					// 协调打架的位置（它只管理自己创建的那些子节点）。
					if (lead) return { parent: lead, before: null };
					const parent = header.parentNode;
					if (!parent) return null;
					return { parent, before: header.nextSibling };
				}

				/** 把搜索条挪到落点。移动会打断焦点，所以自己保存/恢复焦点与光标位置。 */
				function place(slot) {
					const current = ui.bar.parentNode;
					if (current === slot.parent) {
						if (slot.before === null) {
							if (ui.bar === slot.parent.lastElementChild) return;
						} else if (ui.bar.nextSibling === slot.before) {
							return;
						}
					}
					const focused = document.activeElement === ui.input;
					const start = focused ? ui.input.selectionStart : null;
					const end = focused ? ui.input.selectionEnd : null;
					slot.parent.insertBefore(ui.bar, slot.before);
					if (focused) {
						try {
							ui.input.focus({ preventScroll: true });
							restoreSelection(ui.input, start, end);
						} catch (error) {
							/* 焦点恢复失败不影响过滤本身。 */
						}
					}
				}

				function restoreSelection(el, start, end) {
					if (typeof el.setSelectionRange !== "function") return;
					if (start === null || end === null) return;
					el.setSelectionRange(start, end);
				}

				/** 摘掉搜索条，并清掉所有隐藏标记（把 DOM 还给外壳原样）。 */
				function detach() {
					if (ui.bar.parentNode) ui.bar.parentNode.removeChild(ui.bar);
					if (hidAnything) resetVisibility();
				}

				/** 我们到底有没有藏过东西 —— 没藏过就不必为了「恢复原样」再查一遍文档。 */
				function resetVisibility() {
					const nodes = document.querySelectorAll(`[${HIDDEN_ATTR}]`);
					for (const node of nodes) node.removeAttribute(HIDDEN_ATTR);
					hidAnything = false;
				}

				function sync() {
					if (disposed) return;

					// 快速退出：观察的是整个 document.body，会话流式输出时 mutation 会持续不断。
					// 「插件」页不在场上时连样式表都不必碰 —— 一个 querySelector 就走人。
					const panels = document.querySelectorAll(SELECTORS.panel);
					if (panels.length === 0) {
						detach();
						return;
					}

					ensureStyles();
					const slot = findSlot(panels);
					if (!slot) {
						detach();
						return;
					}

					const cards = document.querySelectorAll(SELECTORS.card);
					const loading = document.querySelector(SELECTORS.loading) !== null;
					// 没有卡片可搜、也不在加载中（不可用 / 出错 / 空列表）：不摆搜索框。
					if (cards.length === 0 && !loading) {
						detach();
						return;
					}

					place(slot);

					const terms = splitQuery(query);
					hidAnything = false;
					let shown = 0;
					let hidden = 0;
					for (const card of cards) {
						const id = card.getAttribute(SELECTORS.idPackage)
							?? card.getAttribute(SELECTORS.idItem)
							?? "";
						// 命中范围 = 卡片上看得见的全部文字 + 包名/id（后者在界面上多半不显示，
						// 但「按包名找插件」是很自然的用法）。
						const hit = terms.length === 0
							|| matchesQuery(`${card.textContent ?? ""} ${id}`, terms);
						if (hit) {
							if (card.hasAttribute(HIDDEN_ATTR)) card.removeAttribute(HIDDEN_ATTR);
							shown++;
						} else {
							if (!card.hasAttribute(HIDDEN_ATTR)) card.setAttribute(HIDDEN_ATTR, "");
							hidden++;
						}
					}
					hidAnything = hidden > 0;

					// 整组都没有命中卡片时，连组标题和计数一起藏掉 —— 留下「官方 0」这种空壳
					// 比不显示更让人迷惑。搜索词为空时全组照常显示。
					//
					// 判据必须是「组里还有没有可见卡片」，而不是「组里有没有被藏起来的卡片」：
					// 一个组里既有命中也有不命中是常态（比如搜 sidebar，已安装组里还有别的卡
					// 片被藏了），按后者会把整组误藏。
					for (const group of document.querySelectorAll(SELECTORS.group)) {
						const empty = terms.length > 0
							&& group.querySelector(VISIBLE_CARD) === null;
						if (empty) group.setAttribute(HIDDEN_ATTR, "");
						else group.removeAttribute(HIDDEN_ATTR);
					}

					// 自己报数，不去改外壳那个 data-plugin-count 文本节点（它是 React 管的，
					// 抢着写会和它的 diff 打架）。
					if (terms.length === 0 || cards.length === 0) {
						setText(ui.status, "");
					} else if (shown === 0) {
						setText(ui.status, dict.noResults);
					} else {
						setText(ui.status, format(dict.status, { shown, total: cards.length }));
					}

					ui.clear.hidden = query.length === 0;
				}

				/** 合并一串 mutation/连续输入，落到一个微任务里执行，避免一帧多次布局。 */
				function schedule() {
					if (scheduled || disposed) return;
					scheduled = true;
					queueMicrotask(() => {
						scheduled = false;
						sync();
					});
				}

				// ── 事件 ────────────────────────────────────────────────────────

				ui.input.addEventListener("input", () => {
					query = ui.input.value;
					sync();
				});

				ui.input.addEventListener("keydown", (event) => {
					if (event.key !== "Escape") return;
					if (query.length === 0) return;
					// 自己消费掉 Esc（清空搜索），别让它冒泡去关掉外壳的面板。
					event.stopPropagation();
					query = "";
					ui.input.value = "";
					sync();
				});

				ui.clear.addEventListener("click", () => {
					query = "";
					ui.input.value = "";
					sync();
					try {
						ui.input.focus({ preventScroll: true });
					} catch (error) {
						/* 聚焦失败无所谓。 */
					}
				});

				// ── 起搏 ────────────────────────────────────────────────────────

				ensureStyles();
				relabel(ui, dict);
				sync();

				// 外壳的列表是 React 渲染的：加载完成、切列表/详情、装卸插件都会重挂卡片。
				// 观察 body 而不是面板本身 —— 面板自己也会被卸载重建（切走再切回来）。
				observer = new MutationObserver(schedule);
				observer.observe(document.body, { childList: true, subtree: true, characterData: true });

				// 语言切换：只换文案，不动输入。
				let unsubscribeLocale = () => {};
				try {
					if (ctx.locale && typeof ctx.locale.subscribe === "function") {
						unsubscribeLocale = ctx.locale.subscribe(() => {
							dict = pickDict(resolveLang(ctx));
							relabel(ui, dict);
							schedule();
						});
					}
				} catch (error) {
					/* 没有 locale 服务：文案停在启动时那一份，不影响搜索。 */
				}

				return () => {
					disposed = true;
					if (observer) observer.disconnect();
					try {
						unsubscribeLocale();
					} catch (error) {
						/* 退订失败不该挡住后面的清理。 */
					}
					detach();
					const tag = document.getElementById(STYLE_ID);
					if (tag) tag.remove();
				};
			}, `${NS}: plugins page filter`);
		}

		exports.NS = NS;
		exports.apply = apply;
		/**
		 * cordis 服务注入：声明了它，ctx.locale 才在 apply 里可用。
		 *
		 * 只声明 locale（每个 Web 组合都随外壳启用，本 profile 里的 dsh-recent-sessions、
		 * dshmarket、ui-plugin-manager 都这么写）。刻意不声明 slots —— 本插件不注册槽位，
		 * 走的是 DOM 注入，少一个依赖就少一条「服务缺失导致整个插件不挂载」的路。
		 *
		 * 下面的代码对 locale 缺失仍有兜底（try/catch + navigator.language 退化），
		 * 所以即使某个组合没有 locale 服务，搜索本身照常工作，只是不跟随语言切换。
		 */
		exports.inject = ["locale"];
		/** 纯函数与选择器，供单元测试直接引用（不含 DOM 副作用）。 */
		exports.__internals = {
			CSS,
			DICT,
			SELECTORS,
			format,
			matchesQuery,
			pickDict,
			resolveLang,
			splitQuery,
		};
		return module.exports;
	},
});
