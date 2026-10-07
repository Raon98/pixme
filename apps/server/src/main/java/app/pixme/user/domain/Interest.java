package app.pixme.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/** Server-owned interest taxonomy; the client ships the same list as a fallback. */
@Entity
@Table(name = "interests")
@Getter
@NoArgsConstructor
public class Interest {

    @Id
    @Column(name = "code", nullable = false, length = 32)
    private String code;

    @Column(name = "label", nullable = false, length = 32)
    private String label;

    @Column(name = "emoji", nullable = false, length = 8)
    private String emoji;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
