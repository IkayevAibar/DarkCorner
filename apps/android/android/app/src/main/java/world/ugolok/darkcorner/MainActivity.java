package world.ugolok.darkcorner;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // The game draws under the system bars on every Android version and pads
        // itself with the insets the page gets (capacitor.config.json: SystemBars,
        // insetsHandling "native"), as Capacitor 9 will do by default. The bars are
        // see-through with light icons: the game is dark whatever the phone's theme.
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        super.onCreate(savedInstanceState);
    }
}
