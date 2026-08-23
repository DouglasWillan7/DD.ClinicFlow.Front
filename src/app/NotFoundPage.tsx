import { ArrowLeft } from "lucide-react";
import { Button } from "../components/Button";
import { useNavigate } from "./navigation";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <span>404</span>
      <h1>Este caminho não faz parte do fluxo.</h1>
      <p>A página pode ter mudado ou o endereço informado está incompleto.</p>
      <Button type="button" onClick={() => navigate("/app/agenda")}>
        <ArrowLeft size={17} />
        Voltar para a agenda
      </Button>
    </main>
  );
}
