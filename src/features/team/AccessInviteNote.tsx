import { Copy } from "lucide-react";
import { useState } from "react";
import type { DoctorAccessInvite } from "../../api/types";
import { buildActivationLink } from "./teamQueries";
import styles from "./TeamPage.module.css";

/**
 * O ClinicFlow ainda não envia e-mail (o único canal de saída é o WhatsApp para pacientes),
 * então o convite aparece como link copiável para a clínica repassar.
 */
export function AccessInviteNote({ invite }: { invite: DoctorAccessInvite }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const link = buildActivationLink(invite.email, invite.token);
  const expiresAt = new Date(invite.expiresAtUtc).toLocaleDateString("pt-BR");

  return (
    <div className={styles.inviteNote}>
      <div>
        <strong>Convite de acesso gerado</strong>
        <p>
          Envie este link para {invite.email}. Ele vale até {expiresAt} e permite
          definir a senha uma única vez.
        </p>
      </div>
      <div className={styles.inviteLink}>
        <input readOnly value={link} aria-label="Link de ativação" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              // Sem permissão de área de transferência o link continua visível para copiar à mão.
              setFailed(true);
            }
          }}
        >
          <Copy size={16} aria-hidden="true" />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <div aria-live="polite">
        {failed ? (
          <p className={styles.inlineError}>
            Não foi possível copiar automaticamente. Selecione o link acima e
            copie.
          </p>
        ) : null}
      </div>
    </div>
  );
}
