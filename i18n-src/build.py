"""Regenerate js/i18n-dict.js from i18n-src/dict.json + val.json.
Usage (from the project root or anywhere):  python3 i18n-src/build.py"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, 'dict.json'), encoding='utf-8'))
V = json.load(open(os.path.join(HERE, 'val.json'), encoding='utf-8'))
en = {k: D[k][1] for k in sorted(D)}; vi = {k: D[k][0] for k in sorted(D)}
def obj(d):
    return '{\n' + ',\n'.join('    ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False) for k, v in d.items()) + '\n  }'
out = ('/* AUTO-GENERATED from i18n-src/dict.json + val.json by i18n-src/build.py — edit the sources, then rebuild.\n'
       ' * en / vi are symmetric (same key set). val = display labels for stored data values (tv()). */\n'
       'window.I18N_DICT = {\n  en: ' + obj(en) + ',\n  vi: ' + obj(vi) + ',\n  val: ' + obj(V) + '\n};\n')
open(os.path.join(HERE, '..', 'js', 'i18n-dict.js'), 'w', encoding='utf-8').write(out)
print('dict keys', len(D), 'val', len(V))
