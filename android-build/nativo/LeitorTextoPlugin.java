package br.bar.caixaportaria;

import android.app.Activity;
import android.content.IntentSender;
import android.graphics.Bitmap;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
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
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

/**
 * Scanner do cardápio com o Google ML Kit.
 * - digitalizar(): abre o scanner de documentos do Google (acha as bordas, recorta, endireita
 *   e deixa nítido) e lê o texto de cada página digitalizada.
 * - ler(): lê o texto de uma foto (base64).
 * Devolve cada linha com a posição, para o app remontar o cardápio (nome, preço, colunas).
 */
@CapacitorPlugin(name = "LeitorTexto")
public class LeitorTextoPlugin extends Plugin {
    private TextRecognizer leitor;
    private ActivityResultLauncher<IntentSenderRequest> scanner;
    private PluginCall chamadaScanner;

    @Override
    public void load() {
        scanner = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::resultadoScanner);
    }

    private TextRecognizer leitor() {
        if (leitor == null) leitor = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        return leitor;
    }

    @PluginMethod
    public void digitalizar(PluginCall call) {
        if (chamadaScanner != null) { call.reject("o scanner já está aberto"); return; }
        GmsDocumentScannerOptions opcoes = new GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(call.getInt("paginas", 4))
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build();
        GmsDocumentScanning.getClient(opcoes).getStartScanIntent(getActivity())
            .addOnSuccessListener(intent -> {
                chamadaScanner = call;
                call.setKeepAlive(true);
                scanner.launch(new IntentSenderRequest.Builder(intent).build());
            })
            .addOnFailureListener(e -> call.reject("scanner indisponível: " + e.getMessage(), "INDISPONIVEL"));
    }

    private void resultadoScanner(ActivityResult r) {
        PluginCall call = chamadaScanner;
        chamadaScanner = null;
        if (call == null) return;
        call.setKeepAlive(false);
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("cancelado", "CANCELADO"); return; }
        GmsDocumentScanningResult res = GmsDocumentScanningResult.fromActivityResultIntent(r.getData());
        List<GmsDocumentScanningResult.Page> paginas = res == null ? null : res.getPages();
        if (paginas == null || paginas.isEmpty()) { call.reject("nenhuma página digitalizada", "CANCELADO"); return; }
        JSArray saida = new JSArray();
        lerPagina(call, paginas, 0, saida);
    }

    private void lerPagina(PluginCall call, List<GmsDocumentScanningResult.Page> paginas, int i, JSArray saida) {
        if (i >= paginas.size()) { JSObject r = new JSObject(); r.put("paginas", saida); call.resolve(r); return; }
        Bitmap bmp;
        try (InputStream in = getContext().getContentResolver().openInputStream(paginas.get(i).getImageUri())) {
            bmp = BitmapFactory.decodeStream(in);
        } catch (Exception e) { call.reject("não consegui abrir a página: " + e.getMessage()); return; }
        if (bmp == null) { call.reject("página inválida"); return; }
        final Bitmap foto = bmp;
        leitor().process(InputImage.fromBitmap(foto, 0))
            .addOnSuccessListener(t -> {
                JSObject p = linhas(t, foto.getWidth(), foto.getHeight());
                p.put("imagem", "data:image/jpeg;base64," + jpeg(foto, 1600, 80));
                saida.put(p);
                lerPagina(call, paginas, i + 1, saida);
            })
            .addOnFailureListener(e -> call.reject("falha na leitura: " + e.getMessage()));
    }

    private static String jpeg(Bitmap b, int max, int qualidade) {
        float k = Math.min(1f, (float) max / Math.max(b.getWidth(), b.getHeight()));
        Bitmap m = k < 1f ? Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * k), Math.round(b.getHeight() * k), true) : b;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        m.compress(Bitmap.CompressFormat.JPEG, qualidade, out);
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private static JSObject linhas(Text t, int largura, int altura) {
        JSObject r = new JSObject();
        r.put("texto", t.getText());
        r.put("largura", largura);
        r.put("altura", altura);
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
        return r;
    }

    /** lerQR(): abre o leitor de QR Code do Google (não precisa de permissão de câmera) e devolve {texto}. */
    @PluginMethod
    public void lerQR(PluginCall call) {
        try {
            GmsBarcodeScannerOptions opcoes = new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build();
            GmsBarcodeScanner leitorQR = GmsBarcodeScanning.getClient(getActivity(), opcoes);
            leitorQR.startScan()
                .addOnSuccessListener(b -> { JSObject r = new JSObject(); r.put("texto", b.getRawValue()); call.resolve(r); })
                .addOnCanceledListener(() -> call.reject("CANCELADO"))
                .addOnFailureListener(e -> call.reject("falha no leitor: " + e.getMessage()));
        } catch (Exception e) {
            call.reject("leitor de QR indisponível: " + e.getMessage());
        }
    }

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
        leitor().process(InputImage.fromBitmap(bmp, 0))
            .addOnSuccessListener(t -> call.resolve(linhas(t, bmp.getWidth(), bmp.getHeight())))
            .addOnFailureListener(e -> call.reject("falha na leitura: " + e.getMessage()));
    }
}
