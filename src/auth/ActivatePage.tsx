import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../api/client";
import { Link, useNavigate, useSearchParams } from "../app/navigation";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useAuth } from "./AuthProvider";
import styles from "./AuthPages.module.css";

const activateSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(120),
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
    confirmation: z.string(),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmation) {
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "As senhas não coincidem.",
      });
    }
  });

type ActivateForm = z.infer<typeof activateSchema>;

/** Destino do link de convite: o médico já existe na clínica e só precisa definir a senha. */
export function ActivatePage() {
  const { activate } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = (params.get("email") ?? "").trim();
  const token = (params.get("token") ?? "").trim();
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivateForm>({ resolver: zodResolver(activateSchema) });

  if (!email || !token) {
    return (
      <div className={styles.card}>
        <header>
          <h1>Link de ativação incompleto.</h1>
          <p>
            Abra o link exatamente como a clínica enviou. Se ele expirou, peça um
            novo convite.
          </p>
        </header>
        <p className={styles.switch}>
          Já tem senha? <Link to="/entrar">Entrar</Link>
        </p>
      </div>
    );
  }

  const submit = handleSubmit(async ({ name, password }) => {
    setServerError(undefined);
    try {
      await activate(email, token, password, name);
      navigate("/app/agenda", { replace: true });
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível ativar o acesso. Verifique sua conexão.",
      );
    }
  });

  return (
    <div className={styles.card}>
      <header>
        <h1>Ative seu acesso.</h1>
        <p>
          Sua clínica já cadastrou seu perfil profissional. Defina uma senha para{" "}
          {email}.
        </p>
      </header>
      <form className={styles.form} onSubmit={submit} noValidate>
        {serverError ? (
          <div className={styles.serverError} role="alert">
            {serverError}
          </div>
        ) : null}
        <Field
          label="Nome"
          autoComplete="name"
          placeholder="Como você assina"
          error={errors.name?.message}
          {...register("name")}
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="Ao menos 8 caracteres"
          error={errors.password?.message}
          {...register("password")}
        />
        <Field
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          error={errors.confirmation?.message}
          {...register("confirmation")}
        />
        <Button type="submit" loading={isSubmitting}>
          Ativar acesso
        </Button>
      </form>
      <p className={styles.switch}>
        Já ativou antes? <Link to="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
