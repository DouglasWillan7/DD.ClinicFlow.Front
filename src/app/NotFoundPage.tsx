import { ArrowLeft } from "lucide-react";
import { Button } from "../components/Button";
import { PublicLayout } from "../components/PublicLayout";
import { useNavigate } from "./navigation";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <PublicLayout>
      <section className={styles.card}>
        <span>404</span>
        <h1>Este caminho não faz parte do fluxo.</h1>
        <p>A página pode ter mudado ou o endereço informado está incompleto.</p>
        {/* "/app" resolve o início de cada vínculo: Início para médico, Agenda para a equipe. */}
        <Button type="button" onClick={() => navigate("/app")}>
          <ArrowLeft size={17} aria-hidden="true" />
          Voltar para o início
        </Button>
      </section>
    </PublicLayout>
  );
}
