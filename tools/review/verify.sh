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

if [ -e "$LOCK" ]; then
  echo "**検証が既に走っている** (pid $(cat "$LOCK" 2>/dev/null))"
  echo "止めるなら: rm -f '$LOCK' して、chrome/node を落としてから回し直す"
  exit 2
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT INT TERM

cd "$DIR" || exit 1

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
  out=$(node "$f" "$DIR" 2>&1 | tail -40)
  c=$(echo "$out" | grep -cE "^[[:space:]]*(Blocker|Major|Minor|Nit)")
  echo "$n findings=$c"
  if [ "$c" != "0" ]; then
    echo "$out" | grep -E "^[[:space:]]*(Blocker|Major|Minor|Nit)" | sed "s|^|  $n:: |"
  fi
done

echo "=== ゲート ==="
node tools/review/gate.js "$DIR" 2>&1 | tail -22
echo "=== 完走 ==="
