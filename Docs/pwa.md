# PWA

설치형 웹앱이다. `vite-plugin-pwa`가 빌드할 때 `manifest.webmanifest`와 service worker를 만든다. `npm run dev`에서는 service worker를 켜지 않는다(`devOptions.enabled: false`). 개발 중 새로고침은 항상 최신 소스를 본다.

## 캐시

Workbox `generateSW`가 빌드 결과 전체를 미리 캐시한다. 대상은 `**/*.{js,css,html,svg,woff2,png,webmanifest}`이고, three.js 청크가 기본 한도(2MB)를 넘어도 캐시되도록 파일당 한도는 4MB다. 한 번 온라인으로 연 뒤에는 앱 셸, JS, 폰트, 아이콘이 캐시에 있어 오프라인에서도 게임이 열린다. 세이브는 IndexedDB(`herotown`)라 네트워크와 무관하다.

새 빌드가 배포되면 기다리는 service worker가 생기고, 화면 위 토스트의 "새로고침"을 눌러야 교체된다. 자동으로 새로고침하지 않는다.

## 아이콘

`public/favicon.svg`의 방패를 `node tools/render-pwa-icons.mjs`로 다시 그린다. 스크립트가 처음 실행될 때 `@resvg/resvg-js`를 `tools/.icon-deps`(gitignore)에 받는다. 결과는 `public/icons/`에 커밋한다.

- `icon-192.png`, `icon-512.png`: 설치 아이콘
- `icon-maskable-512.png`: 원형 마스크에 잘리지 않도록 여백을 더 둠
- `apple-touch-180.png`: `index.html`의 apple-touch-icon

배경색은 `styles.css`의 `--sky`(`#cfe6f2`), 테마색은 `--paper`(`#fff8ec`)다.
