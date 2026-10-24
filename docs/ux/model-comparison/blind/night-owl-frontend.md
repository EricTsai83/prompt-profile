# Blind review: night-owl-frontend

Synthetic persona. Engine and model labels are removed; the order is shuffled.

## Profile A

**Headline:** You're a late-night frontend perfectionist who fixes things a pixel and an aria-label at a time, and you usually know the real root cause before the AI does.

**Archetype:** The Midnight Pixel Medic: You turn up around 22:00 and often keep going past 2 a.m. In that time you make a long string of small, precise fixes: gap 12px, a lighter shadow, a 44px touch target, a focus ring in the brand color. Your prompts are short Traditional Chinese with English technical terms mixed in. When the AI's diagnosis is wrong, you say 不對 and name the actual cause, like touch-action, iOS rubber band scroll or a CSS background image. You care a lot about accessibility and performance, you prefer native CSS to adding another library, and when a fix keeps failing you're happy to ship a simpler workaround and come back to it later.

### Traits

- **Root-cause corrector** (high): When the AI suggests a generic fix, you reject it and name the actual cause yourself.
  - "不是這樣，問題是 iOS 的 rubber band scroll"
  - "不是效能問題，是 touch-action 沒設"
  - "不是這個問題，hero 圖是 CSS background，不會被 preload"
- **Accessibility advocate** (high): Contrast, focus states, aria-labels, reduced motion and touch-target size come up regularly in your requests.
  - "不對，icon-only 的按鈕要有 aria-label"
  - "加上 prefers-reduced-motion 的處理"
  - "購物車的數量按鈕在手機上太小了，至少 44px"
  - "送出的時候沒有 focus 到第一個錯誤欄位"
- **Pragmatic workaround picker** (high): If a fix keeps failing, you drop it, ship something simpler that works, and plan to come back to it.
  - "算了先把 sticky 拿掉，改成固定在頂部的 position fixed + padding-top"
  - "好，那先用原生 img，我之後再處理"
  - "那改用系統字型 fallback，標題才用 webfont"
- **Pixel-level iterator** (medium): You adjust the UI one small, specific change at a time until it looks right.
  - "不對，間距太大了，gap 改成 12px"
  - "還是不行，卡片高度不一致，用 flex 讓按鈕貼底"
  - "陰影太重了，淡一點，像 tailwind 的 shadow-sm"
- **Lightweight, maintainable choices** (medium): You prefer native CSS and browser APIs, design tokens and automated checks to extra dependencies and hard-coded values.
  - "不要用 framer-motion，用 CSS + IntersectionObserver 就好"
  - "dark mode 的顏色幫我從 design token 產生，不要寫死"

### Dimensions

- **Four-minute feedback loops after dark**: You work in quick cycles: ask for something small, check how it looks, then send a specific correction. Each follow-up adds one requirement. When something stays stuck, you switch to a simpler approach that works and leave the full fix for later. Almost all of this happens between late evening and the early morning.
  - "不對，間距太大了，gap 改成 12px"
  - "OK 這樣可以。順便把 hover 加個陰影"
  - "算了先把 sticky 拿掉，改成固定在頂部的 position fixed + padding-top"
  - "好，那先用原生 img，我之後再處理"
- **Blunt, short and focused on root causes**: Your prompts are very short Traditional Chinese with English technical terms mixed in. You don't soften corrections. You say 不對 or 還是錯, and you usually follow with the exact fix or the real cause. You often throw out the AI's generic diagnosis and replace it with your own.
  - "不是效能問題，是 touch-action 沒設"
  - "不是這個問題，hero 圖是 CSS background，不會被 preload"
  - "錯了，category 是陣列，不是字串"
  - "還是錯，你改到桌機版了"
- **Detail-oriented React frontend developer**: You work with React, Next.js, React Query, zod, cva and Storybook, and you use Tailwind conventions. You know browser CSS well, including sticky vs fixed positioning, touch-action and font-display. You prefer native, lightweight solutions to pulling in another dependency.
  - "幫我寫一個 useProducts hook，支援分頁跟 category filter"
  - "variant 用 cva 管理"
  - "不要用 framer-motion，用 CSS + IntersectionObserver 就好"
  - "font-display 用 swap"
- **Accessibility, performance and polish**: You keep asking for accessibility features: WCAG AA contrast, prefers-reduced-motion, aria-labels, keyboard navigation, visible focus rings and 44px touch targets. You also track LCP and font payload size. You care about small finishing touches like a badge that bounces at the end of an animation, and you want design tokens and automated checks instead of hard-coded values.
  - "不對不對，對比度不夠，文字要符合 WCAG AA"
  - "focus ring 不要拿掉，改成品牌色"
  - "Lighthouse 的 LCP 是 4.2 秒，幫我看看怎麼降"
  - "幫我寫個 script 檢查所有 token 組合的對比度"
- **Unfinished fight with Next.js static export**: Next.js static export and its Image component keep breaking your build. For now you've switched to a plain img tag and noted that you'll fix it later. Coming back to that, and to the font subsetting that's still 800KB, would be a good next step.
  - "還是不行，build 的時候報錯"
  - "我之後再處理"
  - "subset 之後還是 800KB，太大了"

### Fun facts

- Midnight is your busiest hour, with 13 prompts. Your latest one was sent at 02:36, and you sent nothing at all between 3 a.m. and 10 p.m.
- 96.08% of your prompts are in Chinese, with a median length of just 27 characters.
- 19.61% of your prompts correct the AI, which works out to about one 不對 in every five messages.
- shop-web accounts for 43 of your 51 prompts. Your portfolio got the other 8.
- You never send prompts on Saturday, but Thursday is your busiest day with 13.

Coverage: 34 quotes kept, 0 dropped.

## Profile B

**Headline:** You refine frontend experiences through precise corrections, accessible interactions, and pragmatic performance choices.

**Archetype:** The Midnight UI Editor: You work in short, concrete rounds: adjust a detail, check the result, then tackle the next rough edge. Your attention moves easily between component APIs, browser behavior, accessibility, and loading performance. You give the assistant room to suggest approaches, but bring your own diagnoses and accept practical fallbacks when an ideal solution becomes costly.

### Traits

- **Accessibility stays in scope** (high): You bring accessibility into routine UI work, including labels, motion, contrast, and keyboard focus.
  - "不對不對，對比度不夠，文字要符合 WCAG AA"
  - "加上 prefers-reduced-motion 的處理"
  - "不對，icon-only 的按鈕要有 aria-label"
- **Precise feedback, successive polish** (high): You steer work with small, explicit adjustments and keep refining after the main behavior is acceptable.
  - "不對，間距太大了，gap 改成 12px"
  - "可以了，謝謝，順便幫我把按鈕的 disabled 樣式調一下"
  - "size 也要用 cva，sm md lg"
- **An active debugging partner** (high): You challenge diagnoses and supply concrete browser or rendering details instead of leaving investigation entirely to the assistant.
  - "不是這樣，問題是 iOS 的 rubber band scroll"
  - "不是這個問題，hero 圖是 CSS background，不會被 preload"
  - "不是效能問題，是 touch-action 沒設"
- **Pragmatic about tradeoffs** (medium): You accept simpler implementations when a preferred approach becomes blocked or expensive, while keeping the immediate experience moving forward.
  - "好，那先用原生 img，我之後再處理"
  - "那改用系統字型 fallback，標題才用 webfont"
- **Speed is part of the interface** (high): You care about how quickly an interface feels ready, with attention to loading feedback, animation timing, and font payload.
  - "把 loading 狀態改成 skeleton，不要用 spinner"
  - "動畫太慢了，duration 改 200ms，easing 用 ease-out"
  - "subset 之後還是 800KB，太大了"

### Dimensions

- **Small steps, close inspection**: You build through successive requests and specific feedback, often adding polish once the main fix works. You also accept workable fallbacks when a solution would take more effort than you want to spend immediately.
  - "OK 這樣可以。順便把 hover 加個陰影"
  - "size 也要用 cva，sm md lg"
  - "好，那先用原生 img，我之後再處理"
- **Brief and implementation-specific**: You write concise Traditional Chinese with English technical terms woven in. Your corrections usually identify a concrete mismatch or specify the next change, making short prompts carry substantial implementation detail.
  - "錯了，category 是陣列，不是字串"
  - "動畫太慢了，duration 改 200ms，easing 用 ease-out"
  - "focus ring 不要拿掉，改成品牌色"
- **React frontend with browser instincts**: Your observed stack includes React Query, Next.js, zod, cva, and Storybook. You work across data fetching, component structure, and rendering behavior, and you contribute browser-specific diagnoses when the assistant's explanation misses the cause.
  - "幫我寫一個 useProducts hook，支援分頁跟 category filter"
  - "結帳頁的表單驗證幫我改用 zod"
  - "Next.js 的 Image 元件在 export 模式下不能用，有替代方案嗎？"
  - "不是效能問題，是 touch-action 沒設"
- **Accessible, responsive interfaces**: You repeatedly attend to contrast, motion preferences, keyboard access, focus behavior, and touch targets. You also care about perceived speed and reusable visual foundations, from loading states to design tokens and font delivery.
  - "幫我寫個 script 檢查所有 token 組合的對比度"
  - "加上 prefers-reduced-motion 的處理"
  - "對，pan-y。順便讓它支援鍵盤左右鍵"
  - "首頁的字型換成 Noto Sans TC，但只載入用得到的字"
- **Learn through concrete constraints**: You use targeted questions and implementation trials to investigate uncertainty about caching and browser behavior. Your prompts suggest a practical learning loop: ask about a specific constraint, try an approach, and revise it against the observed result.
  - "React Query 的 staleTime 要設多少比較好？商品資料一小時更新一次"
  - "為什麼 Safari 上 sticky header 會跳一下？"
  - "好，用你說的 overscroll-behavior 試試"
  - "Next.js 的 Image 元件在 export 模式下不能用，有替代方案嗎？"

### Fun facts

- Your latest recorded prompt landed at 02:36—UI polish has a late shift.
- Your median prompt length is 27 characters: compact instructions are your default.
- Your recorded language mix is 96.08% Chinese and 3.92% mixed language.
- Your project split is 43 prompts for shop-web and 8 for portfolio.
- Your correction rate is 19.61%; giving the assistant a course correction is part of your workflow.

Coverage: 32 quotes kept, 0 dropped.

## Profile C

**Headline:** You refine frontend experiences through precise corrections, accessible interactions, and practical engineering tradeoffs—often well after midnight.

**Archetype:** The Midnight UI Refiner: You work in short feedback loops, spotting the spacing, browser behavior, or missing keyboard interaction that needs attention next. Your prompts combine concrete implementation choices with a persistent concern for how interfaces feel and function. When an approach keeps resisting, you choose a workable fallback and keep moving.

### Traits

- **Precision through iteration** (high): You refine working details with explicit values and follow-up requirements, keeping feedback immediately actionable.
  - "不對，間距太大了，gap 改成 12px"
  - "動畫太慢了，duration 改 200ms，easing 用 ease-out"
  - "size 也要用 cva，sm md lg"
- **Accessibility stays on your radar** (high): You repeatedly catch usability requirements across visual design, motion, forms, and keyboard interaction.
  - "不對不對，對比度不夠，文字要符合 WCAG AA"
  - "加上 prefers-reduced-motion 的處理"
  - "還是不行，送出的時候沒有 focus 到第一個錯誤欄位"
  - "對，pan-y。順便讓它支援鍵盤左右鍵"
- **Pragmatic about tradeoffs** (high): You persist with problems but can change tactics, simplify an implementation, or defer work when a fallback gets you moving.
  - "算了先把 sticky 拿掉，改成固定在頂部的 position fixed + padding-top"
  - "好，那先用原生 img，我之後再處理"
  - "那改用系統字型 fallback，標題才用 webfont"
- **An active debugging partner** (high): You challenge incorrect diagnoses and contribute specific causes, keeping the assistant anchored to the actual browser behavior.
  - "不是這樣，問題是 iOS 的 rubber band scroll"
  - "不是這個問題，hero 圖是 CSS background，不會被 preload"
  - "不是效能問題，是 touch-action 沒設"

### Dimensions

- **Small steps, explicit checks**: You steer implementation through compact requests and precise adjustments. You also use measurable quality targets and accept practical fallbacks when further effort has diminishing returns.
  - "不對，間距太大了，gap 改成 12px"
  - "幫我寫個 script 檢查所有 token 組合的對比度"
  - "好，那先用原生 img，我之後再處理"
- **Brief and technically specific**: You communicate in concise Traditional Chinese with English technical terms woven in. Your corrections usually identify the exact mismatch, and your acknowledgments often lead directly into the next refinement.
  - "錯了，category 是陣列，不是字串"
  - "可以了，謝謝，順便幫我把按鈕的 disabled 樣式調一下"
  - "font-display 用 swap"
- **Frontend depth, browser awareness**: Your work spans React data fetching, form validation, reusable components, and Next.js constraints. You bring your own browser and rendering diagnoses, giving the assistant specific technical hypotheses to work from.
  - "幫我寫一個 useProducts hook，支援分頁跟 category filter"
  - "結帳頁的表單驗證幫我改用 zod"
  - "幫我把整個 Button 元件重構，variant 用 cva 管理"
  - "不是這個問題，hero 圖是 CSS background，不會被 preload"
- **Polish that stays usable**: You pay attention to shadows, loading states, animation, and typography. Accessibility recurs alongside that visual work through contrast, reduced motion, accessible names, and keyboard focus.
  - "陰影太重了，淡一點，像 tailwind 的 shadow-sm"
  - "把 loading 狀態改成 skeleton，不要用 spinner"
  - "加上 prefers-reduced-motion 的處理"
  - "focus ring 不要拿掉，改成品牌色"
- **Turn recurring fixes into guardrails**: You already show a move toward reusable quality controls through contrast scripts, design tokens, and component stories. A useful next step would be to bring your recurring accessibility and interaction requirements into initial acceptance criteria, reducing the need to add them during correction rounds.
  - "幫我寫個 script 檢查所有 token 組合的對比度"
  - "幫我補 storybook 的 stories"
  - "不對，icon-only 的按鈕要有 aria-label"

### Fun facts

- Your latest recorded prompt landed at 02:36 in Asia/Taipei—late-night UI tuning has receipts.
- You wrote 51 prompts across 12 sessions and 12 active days.
- Your median prompt length was 27 characters: compact requests are your usual format.
- Your recorded correction rate was 19.61%; you regularly steer the assistant back on course.
- Your project split was 43 prompts for shop-web and 8 for portfolio.

Coverage: 30 quotes kept, 0 dropped.

## Profile D

**Headline:** You're a midnight frontend perfectionist who knows exactly how many pixels, milliseconds and contrast ratios you want, and you'll tell the AI 不對 until it gets them right.

**Archetype:** The Midnight Pixel Tuner: Your shop's UI gets polished after the city goes quiet. Your sessions run from about 22:40 to 02:36, and you build them from tight loops: ask for a small change, look at it, then send a precise correction like "gap 改成 12px" or "duration 改 200ms". You know your browser quirks, from iOS rubber-band scrolling to touch-action to LCP and background images. Accessibility comes up again and again in your prompts, and you don't treat it as an afterthought. When something just won't work, you stop fighting it, ship a simpler fallback and note that you'll come back to it later.

### Traits

- **Spec-level precision** (high): You don't say 'make it nicer'. You give pixel values, durations, easing curves and named approaches.
  - "動畫太慢了，duration 改 200ms，easing 用 ease-out"
  - "購物車的數量按鈕在手機上太小了，至少 44px"
  - "不對，間距太大了，gap 改成 12px"
  - "font-display 用 swap"
- **Accessibility advocate** (high): A11y comes up across many sessions without anyone asking for it: contrast, reduced motion, aria-labels, keyboard support, focus management.
  - "加上 prefers-reduced-motion 的處理"
  - "送出的時候沒有 focus 到第一個錯誤欄位"
  - "不對，icon-only 的按鈕要有 aria-label"
  - "對，pan-y。順便讓它支援鍵盤左右鍵"
- **Root-cause corrector** (high): When the AI goes down the wrong path, you correct it bluntly and point to the real cause.
  - "不是效能問題，是 touch-action 沒設"
  - "錯了，category 是陣列，不是字串"
  - "不是這樣，問題是 iOS 的 rubber band scroll"
- **Pragmatic bail-out** (high): When a fix keeps failing, you switch to a simpler fallback instead of sinking more time into debugging.
  - "算了先把 sticky 拿掉，改成固定在頂部的 position fixed + padding-top"
  - "好，那先用原生 img，我之後再處理"
  - "改成 img + fetchpriority=high 試試看"
- **One-step-at-a-time builder** (medium): You start with a task and add one requirement per message, checking each result before moving on.
  - "size 也要用 cva，sm md lg"
  - "幫我補 storybook 的 stories"
  - "對，就是這樣。再幫我加個加入購物車的小動畫"

### Dimensions

- **Tiny loops after midnight**: You work in short, visual iterations about four minutes apart. Each prompt adds one tweak, and you check the result yourself before asking for the next. Your sessions cluster late at night, and you're practical when you get stuck: you drop an approach that keeps failing in favour of a simpler workaround.
  - "OK 這樣可以。順便把 hover 加個陰影"
  - "陰影太重了，淡一點，像 tailwind 的 shadow-sm"
  - "算了先把 sticky 拿掉，改成固定在頂部的 position fixed + padding-top"
  - "subset 之後還是 800KB，太大了"
- **Terse, exact, blunt**: You write very short prompts in Traditional Chinese with English technical terms mixed in, and you skip pleasantries. When the AI misses, you say so plainly and name the actual problem. You give concrete numbers and also say which tools you don't want used.
  - "不對，間距太大了，gap 改成 12px"
  - "還是錯，你改到桌機版了"
  - "不要用 framer-motion，用 CSS + IntersectionObserver 就好"
  - "不是效能問題，是 touch-action 沒設"
- **Modern React frontend, browser-quirk fluent**: Your stack is React, Next.js (static export), React Query, Tailwind, cva, zod and Storybook. What stands out more than the stack is how well you know the browser itself: Safari sticky glitches, iOS rubber-band scrolling, Android touch handling and how LCP preloading works.
  - "React Query 的 staleTime 要設多少比較好？"
  - "不是這樣，問題是 iOS 的 rubber band scroll"
  - "hero 圖是 CSS background，不會被 preload"
  - "幫我把整個 Button 元件重構，variant 用 cva 管理"
- **Accessibility, polish and performance**: You keep coming back to accessibility: WCAG contrast, reduced motion, aria-labels, keyboard navigation, focus rings and touch-target size. You also care about micro-interactions, skeleton loaders, design tokens and keeping payloads small.
  - "對比度不夠，文字要符合 WCAG AA"
  - "focus ring 不要拿掉，改成品牌色"
  - "dark mode 的顏色幫我從 design token 產生，不要寫死"
  - "動畫結束後 badge 要跳一下"
- **A growing pile of 'later'**: Your workarounds keep you moving, but some of them are deferred fixes, like plain img instead of next/image or system-font fallbacks. Keeping a short list of these 'later' items would stop them from quietly becoming permanent. Writing a few requirements up front, such as states, a11y and sizes, could also save you a few correction rounds.
  - "好，那先用原生 img，我之後再處理"
  - "那改用系統字型 fallback，標題才用 webfont"
  - "你漏了電話欄位"

### Fun facts

- Between 03:00 and 21:59 you sent zero prompts. Midnight is your busiest hour, with 13 prompts, and your latest one went out at 02:36.
- You never send prompts on Fridays: 0 prompts there, compared with 13 on Thursdays and 12 on both Mondays and Sundays.
- 96.08% of your prompts are in Chinese, and your median prompt is just 27 characters long.
- About 19.61% of your prompts correct the AI, which works out to roughly one 不對 for every five requests.
- 43 of your 51 prompts went to shop-web. That cart badge got a lot of attention.

Coverage: 36 quotes kept, 0 dropped.
