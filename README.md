# element-quiz

元素記号暗記ツール。周期表の空欄に元素記号と元素名を入力して覚えるためのWebページです。

元素名の表記は文部科学省「一家に1枚周期表」(第13版) に準拠しています。

## 開発

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に出力
```

## 公開

`main` ブランチに push すると GitHub Actions が GitHub Pages に公開します。
初回のみ、リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にしてください。
