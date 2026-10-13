package app.pixme.user;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * One-way hash of a social identity, for the deleted-account fingerprint
 * ledger. Not a security primitive — there is no secret here to protect
 * against a targeted guess, just enough one-wayness that the ledger itself
 * does not amount to storing the provider's user id in the clear.
 */
public final class IdentityFingerprint {

    private IdentityFingerprint() {}

    public static String of(String provider, String providerUserId) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(
                    (provider + ':' + providerUserId).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
