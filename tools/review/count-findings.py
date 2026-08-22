# -*- coding: utf-8 -*-
# レビュアーの出力 (out/<name>.json) の件数を数え、必要なら中身を出す。
# **ゲートと同じ情報源を読む**ためのもの。標準出力を grep で数える方式は
# レビュアーの印字形式と合っておらず、どの実行でも 0 になっていた。
import io, json, sys
name = sys.argv[1]
path = 'tools/review/out/' + name + '.json'
try:
    d = json.load(io.open(path, encoding='utf-8'))
except IOError:
    print(name + ' findings=(出力なし)'); sys.exit(0)
except Exception:
    print(name + ' findings=(壊れた出力)'); sys.exit(0)
n = len(d) if isinstance(d, list) else 0
print(name + ' findings=' + str(n))
if n:
    for x in d[:5]:
        print('  ' + name + ':: ' + json.dumps(x, ensure_ascii=False)[:200])
    if n > 5:
        print('  ' + name + ':: ... 他 ' + str(n - 5) + ' 件')
