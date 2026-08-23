#!/bin/bash
# 全体検証。**この形にした理由が2つある。**
#
# 1) 段階が「何も出さない」ことを成功と区別できなかった。
#    tests/unit という存在しないパスを叩き、空のまま次へ進み、
#    単体テスト1件の失敗を見逃していた。→ 出力が空なら落とす。
#
# 2) **同じ検証を4本同時に走らせた。** 前の実行が終わる前に次を起動し、
#    同じ test-results と CPU を奪い合った。結果は信用できない。
#    → ロックファイルで多重起動を弾く。
set -u
DIR="${1:-$PWD}"
LOCK="$DIR/.verify.lock"

# **古いロックが残っていたら引き継ぐ。**
# 実際に起きたこと: 修正前の verify.sh (無条件に rm する trap) を持つ実行が
# 生き残っており、終了したときに**次の実行のロックを消した**。
# 逆に、異常終了するとロックだけが残り、以後ずっと起動できなくなる。
# ロックの持ち主が生きているかを確かめ、死んでいれば奪う。
if [ -e "$LOCK" ]; then
  OWNER=$(cat "$LOCK" 2>/dev/null)
  if [ -n "$OWNER" ] && kill -0 "$OWNER" 2>/dev/null; then
    echo "**検証が既に走っている** (pid $OWNER)"
    echo "止めるなら: kill $OWNER してから回し直す"
    exit 2
  fi
  echo "(古いロック pid $OWNER は死んでいるので引き継ぐ)"
fi
echo $$ > "$LOCK"
# **自分のロックだけを消す。**
#
# 元は `rm -f "$LOCK"` を無条件にしていた。前の実行のシェルが後から終了すると、
# その trap が**次の実行のロックを消した**。結果、2本が同時に走り、
# 片方が途中で死んだ (実測: verify70 が 22観点目で停止、verify71 は
# ロックが消えたまま e2e を継続)。
# ロックの中身が自分の PID のときだけ消す。
trap '[ "$(cat "$LOCK" 2>/dev/null)" = "$$" ] && rm -f "$LOCK"' EXIT INT TERM

cd "$DIR" || exit 1

# 検証中にソースが変わっていないことを確かめる。
#
# **ロックは検証の多重起動しか防げない。** 実際に起きたのは、検証が走っている
# 最中に私が変異テストで src/app.js と mermaid-assist.html を書き換えたこと。
# 検証は途中 (22観点目) で死に、ゲートまで到達しなかった。
# 「走り切らなかった」ことには気付けたが、**気付けたのは偶然**で、
# 途中まで緑だったので「進んでいる」と誤読しかけた。
#
# 開始時と終了時のハッシュを比べ、変わっていたらその実行を無効と宣言する。
srchash() { find src mermaid-assist.html tests tools -type f   \( -name '*.js' -o -name '*.html' \) -not -path '*/node_modules/*'   -exec md5sum {} + 2>/dev/null | sort | md5sum | cut -d' ' -f1; }
HASH_BEFORE=$(srchash)

step() {
  n="$1"; shift
  echo "=== $n ==="
  out=$("$@" 2>&1)
  if [ -z "$out" ]; then
    echo "**$n の出力が空。段階が実行されていない**"
    return 1
  fi
  echo "$out" | tail -3
}

step "unit"   npm test           || exit 1
step "render" npm run test:render || exit 1
step "e2e"    npx playwright test --reporter=line || exit 1

echo "=== 観点 ==="
# **`r*.js` だけを回していた。** ゲートは terms / record-claims /
# backlog-premises / version-freshness も見ており、回さないと
# 「ソースより古い」で落ちる。検査器が作る物と、検査器が読む物がずれていた。
# lib.js と gate.js は実行対象ではないので外す。
for f in $(ls tools/review/*.js | grep -vE '/(lib|gate)\.js$'); do
  n=$(basename "$f" .js)
  node "$f" "$DIR" > /dev/null 2>&1
  # **指摘の数え方が壊れていた。** 標準出力を grep で数えていたが、
  # レビュアーはその形式で印字しない。**どの実行でも必ず 0 になる数え方**だった。
  # 実測: r18 の JSON に 21 件あるのに findings=0 と出ていた。ゲートの LOOP
  # だけが本当の測定で、私は何ラウンドも壊れた数え方で「指摘0」と報告していた。
  # **ゲートと同じ out/*.json を読む。**
  python tools/review/count-findings.py "$n"
done

echo "=== ゲート ==="
node tools/review/gate.js "$DIR" 2>&1 | tail -22

HASH_AFTER=$(srchash)
if [ "$HASH_BEFORE" != "$HASH_AFTER" ]; then
  echo "=== **この実行は無効** ==="
  echo "検証中にソースが変わった (開始 $HASH_BEFORE / 終了 $HASH_AFTER)。"
  echo "変異テストなどでファイルを書き換えたまま検証を回すと、"
  echo "**どの版を測ったのか言えない**。触るのをやめてから回し直すこと。"
  exit 3
fi
echo "=== 完走 ==="
