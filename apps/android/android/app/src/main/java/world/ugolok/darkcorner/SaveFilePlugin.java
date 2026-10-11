package world.ugolok.darkcorner;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Writes a file through Android's own "Save to" screen (the Storage Access Framework),
 * where the player picks the place. It needs no storage permission on any Android the
 * app runs on. The game saves its Save to a file with it (apps/web/src/native.ts).
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        if (call.getString("text") == null) {
            call.reject("No text to save");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, call.getString("name", "dark-corner.json"));
        startActivityForResult(call, intent, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new java.io.IOException("No stream for " + uri);
            out.write(call.getString("text").getBytes(StandardCharsets.UTF_8));
            call.resolve(new JSObject().put("saved", true));
        } catch (Exception e) {
            call.reject("Could not write the file", e);
        }
    }
}
