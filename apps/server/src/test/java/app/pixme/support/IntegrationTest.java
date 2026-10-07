package app.pixme.support;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Boots the real application against the local Postgres and Redis from
 * {@code docker-compose.yml}.
 *
 * <p>Deliberately not an in-memory database: the schema leans on Postgres
 * features the product's rules are expressed in — the partial unique index
 * that enforces one representative PIXME per day, and {@code DISTINCT ON} for
 * the chat list. A test against H2 would pass while skipping exactly the
 * guarantees worth testing.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
public @interface IntegrationTest {}
