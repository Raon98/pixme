package app.pixme.store.receipt;

import java.io.ByteArrayInputStream;
import java.security.PublicKey;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

import app.pixme.config.PixmeProperties;
import app.pixme.store.domain.StorePlatform;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import java.security.interfaces.ECPublicKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Verifies a StoreKit 2 signed transaction (JWS).
 *
 * <p>StoreKit 2 hands the app a self-contained, Apple-signed JWS per
 * transaction, so verification is offline: no round trip to Apple, no shared
 * secret, no verifyReceipt endpoint. What we must do — and what this class does
 * — is actually check the signature rather than just decoding the payload,
 * which is the mistake that makes a receipt trivially forgeable:
 *
 * <ol>
 *   <li>Parse the JWS and read the {@code x5c} certificate chain from its
 *       header.
 *   <li>Verify the signature with the leaf certificate's public key.
 *   <li>Verify the chain is anchored in Apple's root CA (when the root is
 *       configured) and that no certificate has expired.
 *   <li>Only then trust the payload, and check {@code bundleId} and
 *       {@code productId} match what we expect.
 * </ol>
 *
 * <p>If the Apple root certificate is not configured, the chain check is
 * skipped and that is logged loudly — acceptable in development, never in
 * production.
 */
@Component
public class AppleReceiptVerifier implements ReceiptVerifier {

    private static final Logger log = LoggerFactory.getLogger(AppleReceiptVerifier.class);

    private final PixmeProperties.Purchase.ApplePurchase config;
    private final boolean allowSandbox;
    private final ObjectMapper objectMapper;
    private final List<X509Certificate> rootCertificates;

    public AppleReceiptVerifier(PixmeProperties properties, ObjectMapper objectMapper) {
        this.config = properties.purchase().apple();
        this.allowSandbox = properties.purchase().allowSandbox();
        this.objectMapper = objectMapper;
        this.rootCertificates = loadRootCertificates(config.rootCertificatesPath());

        if (rootCertificates.isEmpty()) {
            log.warn(
                    "Apple root certificate not configured (pixme.purchase.apple.root-certificates-path). "
                            + "Receipt chains will NOT be anchored. Do not run production like this.");
        }
    }

    @Override
    public StorePlatform platform() {
        return StorePlatform.IOS;
    }

    @Override
    public VerifiedPurchase verify(String receipt, String expectedStoreProductId) {
        try {
            JsonNode payload = verifySignedPayload(receipt);
            if (payload == null) {
                return VerifiedPurchase.invalid("signature verification failed");
            }

            String bundleId = payload.path("bundleId").asText(null);
            if (bundleId == null || !bundleId.equals(config.bundleId())) {
                return VerifiedPurchase.invalid("bundleId mismatch: " + bundleId);
            }

            String productId = payload.path("productId").asText(null);
            if (expectedStoreProductId != null && !expectedStoreProductId.equals(productId)) {
                return VerifiedPurchase.invalid("productId mismatch: " + productId);
            }

            String environment = payload.path("environment").asText("Production");
            boolean sandbox = !"Production".equalsIgnoreCase(environment);
            if (sandbox && !allowSandbox) {
                return VerifiedPurchase.invalid("sandbox receipt rejected in production");
            }

            String transactionId = payload.path("transactionId").asText(null);
            String originalTransactionId =
                    payload.path("originalTransactionId").asText(transactionId);
            if (transactionId == null) {
                return VerifiedPurchase.invalid("missing transactionId");
            }

            // A revoked transaction (refund, family-sharing removal) must not
            // grant anything.
            if (payload.has("revocationDate")) {
                return VerifiedPurchase.invalid("transaction revoked");
            }

            Instant expiresAt = payload.has("expiresDate")
                    ? Instant.ofEpochMilli(payload.path("expiresDate").asLong())
                    : null;

            return new VerifiedPurchase(
                    true,
                    transactionId,
                    originalTransactionId,
                    productId,
                    false,
                    expiresAt,
                    expiresAt != null,
                    sandbox,
                    null);

        } catch (Exception exception) {
            log.warn("apple receipt verification failed", exception);
            return VerifiedPurchase.invalid(exception.getClass().getSimpleName());
        }
    }

    private List<X509Certificate> parseChain(List<com.nimbusds.jose.util.Base64> chain)
            throws Exception {
        CertificateFactory factory = CertificateFactory.getInstance("X.509");
        List<X509Certificate> certificates = new java.util.ArrayList<>(chain.size());
        for (com.nimbusds.jose.util.Base64 encoded : chain) {
            certificates.add((X509Certificate) factory.generateCertificate(
                    new ByteArrayInputStream(encoded.decode())));
        }
        return certificates;
    }

    /** Walks the chain and checks each link, ending at a configured root. */
    private boolean isAnchored(List<X509Certificate> chain) {
        try {
            for (int index = 0; index < chain.size() - 1; index++) {
                chain.get(index).verify(chain.get(index + 1).getPublicKey());
            }
            X509Certificate top = chain.get(chain.size() - 1);
            for (X509Certificate root : rootCertificates) {
                try {
                    top.verify(root.getPublicKey());
                    return true;
                } catch (Exception ignored) {
                    // Try the next configured root.
                }
            }
            // The chain may already include the root itself.
            return rootCertificates.stream()
                    .anyMatch(root -> root.getSubjectX500Principal()
                            .equals(top.getSubjectX500Principal()));
        } catch (Exception exception) {
            log.warn("certificate chain validation failed", exception);
            return false;
        }
    }

    /**
     * Accepts a {@code classpath:} resource (how the bundled Apple Root CA -
     * G3 ships, so verification works with zero configuration) or a plain
     * filesystem path (for an operator who wants to mount a different/rotated
     * certificate without a rebuild).
     */
    private List<X509Certificate> loadRootCertificates(String path) {
        if (path == null || path.isBlank()) {
            return List.of();
        }
        try {
            byte[] content = path.startsWith("classpath:")
                    ? new ClassPathResource(path.substring("classpath:".length())).getInputStream().readAllBytes()
                    : java.nio.file.Files.readAllBytes(java.nio.file.Path.of(path));
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            return factory.generateCertificates(new ByteArrayInputStream(content)).stream()
                    .map(certificate -> (X509Certificate) certificate)
                    .toList();
        } catch (Exception exception) {
            log.error("could not load Apple root certificates from {}", path, exception);
            return List.of();
        }
    }

    /**
     * Verifies an Apple-signed JWS's signature and certificate chain and
     * returns its decoded payload — the same check {@link #verify} does, minus
     * the receipt-specific business checks (bundleId, productId, environment).
     *
     * <p>Shared with the webhook handler: App Store Server Notifications V2
     * wraps a {@code signedPayload}, and that payload's {@code data} carries
     * further nested JWS values ({@code signedTransactionInfo},
     * {@code signedRenewalInfo}) in exactly this same format, so one
     * signature-checking method serves all three.
     *
     * @return the decoded payload, or {@code null} if the signature, chain, or
     *     certificate validity could not be verified
     */
    public JsonNode verifySignedPayload(String jws) {
        try {
            JWSObject object = JWSObject.parse(jws);
            JWSHeader header = object.getHeader();

            List<com.nimbusds.jose.util.Base64> chain = header.getX509CertChain();
            if (chain == null || chain.isEmpty()) {
                log.warn("JWS missing x5c chain");
                return null;
            }

            List<X509Certificate> certificates = parseChain(chain);
            X509Certificate leaf = certificates.get(0);

            Instant now = Instant.now();
            for (X509Certificate certificate : certificates) {
                certificate.checkValidity(java.util.Date.from(now));
            }

            if (!rootCertificates.isEmpty() && !isAnchored(certificates)) {
                log.warn("certificate chain not anchored to Apple root");
                return null;
            }

            PublicKey publicKey = leaf.getPublicKey();
            if (!(publicKey instanceof ECPublicKey ecPublicKey)) {
                log.warn("unexpected key type in leaf certificate");
                return null;
            }
            if (!object.verify(new ECDSAVerifier(ecPublicKey))) {
                log.warn("JWS signature verification failed");
                return null;
            }

            return objectMapper.readTree(object.getPayload().toString());
        } catch (Exception exception) {
            log.warn("JWS verification failed", exception);
            return null;
        }
    }

    /** Exposed for the webhook handler, which receives the same JWS format. */
    public JsonNode decodePayloadUnsafe(String jws) {
        try {
            String[] parts = jws.split("\\.");
            return objectMapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
        } catch (Exception exception) {
            return objectMapper.createObjectNode();
        }
    }
}
