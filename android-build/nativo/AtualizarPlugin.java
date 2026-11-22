package br.bar.caixaportaria;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Atualização do app sem desinstalar: baixa o APK novo para a pasta temporária do app e abre
 * o instalador do Android ("Atualizar"). Os dados ficam, porque o APK é assinado com a mesma chave.
 * - instalar({url}): baixa (avisa o progresso com o evento "progresso") e abre o instalador.
 *   Se o Android ainda não deixa este app instalar atualizações, abre a tela para permitir
 *   e devolve {permissao:false}; depois é só tocar de novo.
 */
@CapacitorPlugin(name = "Atualizar")
public class AtualizarPlugin extends Plugin {
    private volatile boolean baixando = false;

    @PluginMethod
    public void podeInstalar(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permissao", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    @PluginMethod
    public void instalar(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) { call.reject("endereço inválido"); return; }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception e) { /* sem a tela de permissão: o instalador pede sozinho */ }
            JSObject r = new JSObject(); r.put("permissao", false); call.resolve(r); return;
        }
        if (baixando) { call.reject("já está baixando"); return; }
        baixando = true;
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                File pasta = new File(getContext().getCacheDir(), "atualizacao");
                pasta.mkdirs();
                File apk = new File(pasta, "BarConect.apk");
                if (apk.exists()) apk.delete();
                // o GitHub redireciona para outro endereço https: segue até 5 vezes
                String atual = url;
                for (int i = 0; i < 6; i++) {
                    con = (HttpURLConnection) new URL(atual).openConnection();
                    con.setInstanceFollowRedirects(false);
                    con.setConnectTimeout(20000); con.setReadTimeout(30000);
                    int code = con.getResponseCode();
                    if (code >= 300 && code < 400) { atual = con.getHeaderField("Location"); con.disconnect(); con = null; if (atual == null) throw new Exception("redirecionamento sem destino"); continue; }
                    if (code != 200) throw new Exception("o servidor respondeu " + code);
                    break;
                }
                if (con == null) throw new Exception("muitos redirecionamentos");
                long total = con.getContentLengthLong(), lido = 0; int ultimo = -1;
                try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); lido += n;
                        if (total > 0) { int p = (int) (lido * 100 / total); if (p != ultimo) { ultimo = p; JSObject ev = new JSObject(); ev.put("p", p); notifyListeners("progresso", ev); } }
                    }
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                JSObject r = new JSObject(); r.put("permissao", true); r.put("ok", true);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("não consegui baixar: " + e.getMessage());
            } finally {
                if (con != null) con.disconnect();
                baixando = false;
            }
        }).start();
    }
}
