#!/bin/bash
# GitHub にリリースするスクリプト
# 使い方: Portfolio フォルダで bash deploy.sh

cd "$(dirname "$0")"

# 全ファイルをステージ（deploy.sh 自身も含む）
git add index.html app.js chart.js data.js heatmap.js \
        portfolio.css positions.js state.js stock-list.js \
        utils.js watchlist.js .gitignore deploy.sh

# 変更があるか確認
if git diff --cached --quiet; then
  echo "変更なし。push をスキップします。"
  exit 0
fi

# コミット（日時を自動でメッセージに）
git commit -m "Update: $(date '+%Y-%m-%d %H:%M')"

# push
git push origin main

echo ""
echo "✅ GitHub にリリースしました → https://shoulang0729.github.io/portfolio/"
