package world.ugolok.darkcorner;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // The game draws under the system bars on every Android version and pads
        // itself with the insets the page gets (capacitor.config.json: SystemBars,
        // insetsHandling "native"), as Capacitor 9 will do by default.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
