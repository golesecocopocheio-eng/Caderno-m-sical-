"""Ajustes do projeto Android gerado pelo Capacitor (rodado pelo workflow depois de `cap add android`).

- Tela de abertura do Android 12+ e fundo da janela em roxo-escuro (#12051F), para não aparecer
  tela branca antes da apresentação do app.
- Câmera: declara a intenção IMAGE_CAPTURE em <queries> (Android 11+), senão o Capacitor não acha
  o app de câmera e abre só o seletor de arquivos.
- Leitor de texto nativo (Google ML Kit) para escanear o cardápio na hora: copia o plugin
  LeitorTexto, registra na MainActivity e adiciona a dependência no build.gradle.
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
# ---- leitor de texto nativo (ML Kit) ----
java = Path('android/app/src/main/java/br/bar/caixaportaria')
shutil.copy('nativo/LeitorTextoPlugin.java', java / 'LeitorTextoPlugin.java')
main = java / 'MainActivity.java'
ma = main.read_text(encoding='utf-8')
if 'LeitorTextoPlugin' not in ma:
    ma = re.sub(r'public class MainActivity extends BridgeActivity\s*\{\s*\}',
        'public class MainActivity extends BridgeActivity {\n'
        '    @Override\n'
        '    public void onCreate(android.os.Bundle savedInstanceState) {\n'
        '        registerPlugin(LeitorTextoPlugin.class);\n'
        '        super.onCreate(savedInstanceState);\n'
        '    }\n'
        '}', ma)
    assert 'LeitorTextoPlugin' in ma, 'MainActivity diferente do esperado: ' + ma
    main.write_text(ma, encoding='utf-8')
gradle = Path('android/app/build.gradle')
g = gradle.read_text(encoding='utf-8')
if 'text-recognition' not in g:
    g, n = re.subn(r'dependencies\s*\{', "dependencies {\n    implementation 'com.google.mlkit:text-recognition:16.0.1'", g, count=1)
    assert n == 1, 'dependencies não encontrado no build.gradle'
    gradle.write_text(g, encoding='utf-8')
# só processadores de celular (ARM): o modelo do leitor vem para cada tipo; tira os de PC (x86)
g = gradle.read_text(encoding='utf-8')
if 'abiFilters' not in g:
    g, n = re.subn(r'(defaultConfig\s*\{)', r"\1\n        ndk { abiFilters 'arm64-v8a', 'armeabi-v7a' }", g, count=1)
    assert n == 1, 'defaultConfig não encontrado'
    gradle.write_text(g, encoding='utf-8')
print('ajustes do Android aplicados')
