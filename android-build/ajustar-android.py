"""Ajustes do projeto Android gerado pelo Capacitor (rodado pelo workflow depois de `cap add android`).

- Tela de abertura do Android 12+ e fundo da janela em roxo-escuro (#12051F), para não aparecer
  tela branca antes da apresentação do app.
- Câmera: declara a intenção IMAGE_CAPTURE em <queries> (Android 11+), senão o Capacitor não acha
  o app de câmera e abre só o seletor de arquivos.
"""
import re, shutil, sys
from pathlib import Path

res = Path('android/app/src/main/res')
(res / 'drawable-nodpi').mkdir(exist_ok=True)
shutil.copy('assets/splash-icone.png', res / 'drawable-nodpi' / 'splash_icone.png')
(res / 'values' / 'bar_cores.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="barFundo">#12051F</color>\n</resources>\n', encoding='utf-8')

estilos = res / 'values' / 'styles.xml'
s = estilos.read_text(encoding='utf-8')
lancamento = '''    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">@color/barFundo</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icone</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:windowBackground">@color/barFundo</item>
    </style>'''
s, n = re.subn(r'    <style name="AppTheme\.NoActionBarLaunch".*?</style>', lancamento, s, flags=re.S)
assert n == 1, 'estilo de abertura não encontrado'
s, n = re.subn(r'(<style name="AppTheme\.NoActionBar" parent="[^"]+">)', r'\1\n        <item name="android:windowBackground">@color/barFundo</item>', s)
assert n == 1, 'estilo principal não encontrado'
estilos.write_text(s, encoding='utf-8')

manif = Path('android/app/src/main/AndroidManifest.xml')
m = manif.read_text(encoding='utf-8')
if 'IMAGE_CAPTURE' not in m:
    m = m.replace('</manifest>', '    <queries>\n        <intent>\n            <action android:name="android.media.action.IMAGE_CAPTURE" />\n        </intent>\n    </queries>\n</manifest>')
manif.write_text(m, encoding='utf-8')
print('ajustes do Android aplicados')
