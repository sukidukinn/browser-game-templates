# Browser Game Templates

GitHub Pagesでそのまま公開できる、ビルド不要のブラウザゲーム用テンプレートです。

## 収録テンプレート

### `tetris-2d/`
Vanilla JavaScript + Canvasだけで動く簡易テトリス。

- 10x20盤面
- 7種テトリミノ
- 回転、ソフトドロップ、ハードドロップ
- ライン消去、スコア、レベル
- localStorageのハイスコア
- 外部ライブラリなし

### `soulslike-3d/`
Three.js CDNだけで動く簡易3Dソウルライク。

- WASD移動
- 近接攻撃
- スタミナ
- 回避＋無敵時間
- ダッシュ
- 敵AI
- HP
- ロックオン切替
- 勝利 / 死亡 / リスタート
- 外部3Dモデル不要

## GitHub Pages公開手順

1. GitHubで新しいリポジトリを作る。例: `browser-game-templates`
2. このフォルダの中身をリポジトリ直下へアップロードする。
3. GitHubの `Settings` → `Pages` を開く。
4. `Build and deployment` の Source を `Deploy from a branch` にする。
5. Branchを `main`、Folderを `/ (root)` にして保存する。
6. 公開URLが発行される。

例:

`https://USERNAME.github.io/browser-game-templates/`

個別ゲーム:

- `https://USERNAME.github.io/browser-game-templates/tetris-2d/`
- `https://USERNAME.github.io/browser-game-templates/soulslike-3d/`

## ローカル確認

2Dテトリスは `tetris-2d/index.html` を直接開いても動きます。

3D版はES Modulesを使うため、ローカルHTTPサーバーで確認してください。

Pythonがある場合:

```bash
python -m http.server 8000
```

その後 `http://localhost:8000/` を開きます。

## 3Dモデルへ差し替える場合

現在はThree.jsのプリミティブだけで描画しています。
将来TripoやUnity Asset → Blender → GLBで用意したモデルを使う場合は、`GLTFLoader`を追加して `makeFighter()` をGLB読み込みへ差し替える構成にしてください。

推奨配置:

```text
soulslike-3d/
  assets/
    models/
      player.glb
      enemy.glb
```

## 方針

このリポジトリは「完成ゲーム」ではなく、今後コピーして改造するための母体です。
Codexを使う場合も、まずテンプレートをコピーし、必要な差分だけ指示することでクレジット消費を抑えやすくなります。
