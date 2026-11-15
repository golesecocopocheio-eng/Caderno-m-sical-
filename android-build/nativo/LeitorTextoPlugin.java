package br.bar.caixaportaria;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Leitor de texto do próprio Android (Google ML Kit, roda no celular e sem internet).
 * Lê uma foto (base64) e devolve o texto e cada linha com a posição na foto,
 * para o app remontar o cardápio (nome à esquerda, preço à direita, colunas).
 */
@CapacitorPlugin(name = "LeitorTexto")
public class LeitorTextoPlugin extends Plugin {
    private TextRecognizer leitor;

    @PluginMethod
    public void ler(PluginCall call) {
        String b64 = call.getString("imagem");
        if (b64 == null || b64.isEmpty()) { call.reject("sem imagem"); return; }
        int virgula = b64.indexOf(',');
        if (b64.startsWith("data:") && virgula > 0) b64 = b64.substring(virgula + 1);
        final Bitmap bmp;
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) { call.reject("imagem inválida: " + e.getMessage()); return; }
        if (bmp == null) { call.reject("imagem inválida"); return; }
        if (leitor == null) leitor = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        leitor.process(InputImage.fromBitmap(bmp, 0))
            .addOnSuccessListener(t -> {
                JSObject r = new JSObject();
                r.put("texto", t.getText());
                r.put("largura", bmp.getWidth());
                r.put("altura", bmp.getHeight());
                JSArray linhas = new JSArray();
                for (Text.TextBlock bloco : t.getTextBlocks()) {
                    for (Text.Line linha : bloco.getLines()) {
                        JSObject o = new JSObject();
                        o.put("t", linha.getText());
                        Rect c = linha.getBoundingBox();
                        if (c != null) { o.put("x", c.left); o.put("y", c.top); o.put("w", c.width()); o.put("h", c.height()); }
                        linhas.put(o);
                    }
                }
                r.put("linhas", linhas);
                call.resolve(r);
            })
            .addOnFailureListener(e -> call.reject("falha na leitura: " + e.getMessage()));
    }
}
